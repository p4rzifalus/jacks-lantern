// Точка входа: собираем правила игры (game.js), картинку и управление, запускаем игровой цикл.
import * as THREE from 'three';
import { HERO_START, BASKET_CELL, PLANTS } from './config.js';
import { cellToWorld, worldToCell, isInGarden, findPathTo, findPathToNeighbor } from './grid.js';
import { createGame, isBasket } from './game.js';
import { RIPE } from './garden.js';
import { createScene, createHoverFrame, createFrontMarker } from './scene.js';
import { Hero } from './hero.js';
import { GardenView } from './world/garden-view.js';
import { createInput } from './input.js';
import { createUI, TOOLS } from './ui.js';
import { createDecor } from './decor.js';
import { detectQuality } from './render/quality.js';
import { createPipeline } from './render/pipeline.js';
import { setTextureLimit } from './art/assets.js';
import { createLighting } from './render/lighting.js';
import { createWeather } from './render/weather.js';
import { createEffects } from './world/effects.js';
import { createLanterns } from './world/lanterns.js';
import { createFogSea } from './world/fog-sea.js';
import { createLightRays } from './world/light-rays.js';
import { applySkyReflex } from './render/sky-reflex.js';
import { createDevPanel, loadFxSettings } from './render/devpanel.js';
import { loadGame, saveGame, clearSave, storeSave, packSave } from './save.js';
import { createMenu } from './menu.js';
import { createSound } from './audio/index.js';
import { createDaytime } from './daytime.js';
import { createDayNight } from './render/day-night.js';
import { setLampLevel } from './render/glow.js';
import { createNight, morningReport } from './night.js';
import { createEmbers } from './world/embers.js';
import { createAttacks } from './world/attacks.js';
import { createSpirits } from './world/spirits.js';

const quality = detectQuality();
setTextureLimit(quality.textureSize); // на слабом качестве картинки уменьшаются при загрузке
const { renderer, scene, camera, cameraControl, world, basket, landmarks, island } = createScene(document.body);
const lighting = createLighting(renderer, scene, quality, landmarks.island); // тени — только над ровной серединой острова
const lanterns = createLanterns(scene, quality);
const effects = createEffects(scene, quality, lanterns.positions);
const weather = createWeather(scene, quality, lighting, landmarks.island);
const fogSea = createFogSea(scene, quality, landmarks.island); // туман под островом и вокруг
const lightRays = createLightRays(scene, quality, lighting); // рассветные лучи и лунное пятно
const fx = loadFxSettings(quality);
const pipeline = createPipeline(renderer, scene, camera, fx, quality);
const daytime = createDaytime(); // часы суток: при каждом входе в игру — утро
const dayNight = createDayNight({ renderer, scene, lighting, pipeline, weather, daytime }); // как выглядит время суток
// Панель настройки (G) — только при разработке; в опубликованной игре её нет
const sound = createSound();
const devPanel = import.meta.env.DEV ? createDevPanel(fx, pipeline, quality, weather, sound.engine, () => hero, fogSea, { daytime, dayNight, spawnSpirit: () => night.spawnNow(), ripenAll }) : null;

// ---------- Правила ----------
let restarting = false; // во время «начать заново» не сохраняем
let menu = null; // меню и стартовый экран (создаются ниже)
let effectJustPlayed = false; // подсказка сразу после действия («+2 мон.») — не ошибка, «нельзя» не звучит
const game = createGame({
  onHint(text, ms) {
    if (!effectJustPlayed) sound.deny();
    ui.hint(text, ms);
  },
  onEffect(name, cell) {
    effectJustPlayed = true;
    queueMicrotask(() => { effectJustPlayed = false; });
    if (name === 'unlocked') return sound.unlocked();
    sound[name](name === 'sold' ? PLANTS[hero.held]?.sellPrice : undefined); // урожай ещё в лапах — по нему считаем монетки
    hero.playAction(); // герой наклоняется: сажает, поливает, собирает, кладёт в корзинку
    const at = cellToWorld(cell.x, cell.z);
    if (name === 'planted') effects.dirt(at);
    if (name === 'watered') effects.water(hero.frontPoint.lerp(hero.position, 0.4), at);
    if (name === 'harvested') effects.sparkle(at);
    if (name === 'sold') effects.coins(at);
  },
  onChange: refresh,
});

// ---------- Картинка ----------
const gardenView = new GardenView(scene, game.garden);
const decor = createDecor(scene, landmarks);

const hero = new Hero();
hero.position.copy(cellToWorld(HERO_START.x, HERO_START.z));
hero.heading = hero.targetHeading = Math.PI; // смотрит на огород
scene.add(hero.object);

// ---------- Ночь: духи ----------
// Правила (кто, когда, что уносит) — night.js; как выглядят и летают — world/spirits.js
const night = createNight({
  game,
  daytime,
  // скоро придёт дух: у его ряда в тумане проступает свечение и звучит «у-у»
  onWarn(row) {
    spirits.warn(row);
    sound.spiritAppear();
  },
  onSpawn: (spirit) => spirits.add(spirit),
  // растения бьют духов: как выглядит — world/attacks.js
  onAttack: (event) => attacks.show(event),
  onHit: (spirit) => attacks.hit(spirit),
  onStolen(spirit, loot) {
    ui.hint(night.describe(spirit, loot), 2800);
  },
  onMorning(summary) {
    spirits.dawn();
    embers.dawn(); // несобранные огоньки сами летят в счётчик
    const rows = morningReport(summary);
    if (rows) menu.showMorning(rows); // утром — окно с итогом ночи (если что-то было)
  },
});
// Огоньки от прогнанных духов: енот подбирает, проходя рядом
const embers = createEmbers(scene, {
  onCollect(at) {
    game.addEmbers(1);
    sound.emberPicked();
    effects.sparkle(at);
  },
});
const spirits = createSpirits(scene, camera, landmarks.island, night, {
  onGrab(spirit, loot, at) {
    sound.spiritGrab();
    if (loot.coins) effects.coins(at);
    else effects.sparkle(at);
  },
  onLeave: () => sound.spiritLeave(),
  // испугался: вспышка у растения, которое напугало, огонёк на месте духа; добыча вернулась
  onScared(spirit, at, from, returned) {
    sound.spiritScared();
    if (from) effects.sparkle(cellToWorld(from.x, from.z));
    embers.add(at);
    if (returned) ui.hint(`${spirit.name} испугался и уронил ${returned.crop ? PLANTS[returned.crop].forms[0] : 'монеты'}`, 2800);
  },
});

// Атаки растений (искры, лучи, споры) и вспышки попаданий
const attacks = createAttacks(scene, (spirit) => spirits.positionOf(spirit));

const hoverFrame = createHoverFrame();
const frontMarker = createFrontMarker();
scene.add(hoverFrame, frontMarker);

// Действия интерфейса — со звуком
function selectTool(id) {
  if (id !== game.state.tool) sound.click();
  game.selectTool(id);
}
function toggleShop(open = !game.state.shopOpen) {
  if (open !== game.state.shopOpen) sound.shop(open);
  game.toggleShop(open);
}

// Камера: крупный план героя и поворот мира по 90°
function toggleCloseUp(on) {
  sound.click();
  cameraControl.toggleCloseUp(on);
  refresh();
}
function rotateWorld(step) {
  sound.click();
  cameraControl.rotate(step, hero.position);
  refresh();
}

const ui = createUI({
  onSelectTool: selectTool,
  onSelectSeed(type) {
    sound.click();
    game.selectSeed(type);
  },
  onBuy(type, count) {
    const coins = game.state.coins;
    game.buySeeds(type, count);
    if (game.state.coins < coins) sound.buy();
  },
  onShopToggle: toggleShop,
  onCloseUp: toggleCloseUp,
  onRotate: rotateWorld,
  onMenu: () => menu.toggle(),
});

// Загрузка сохранения. Растения «досчитываются» сами: стадия считается от момента полива.
const saved = loadGame();
if (saved) {
  game.load(saved);
  const pos = saved.hero || saved.mole; // в старых сохранениях место героя записано как «mole»
  if (pos) {
    hero.position.set(pos.x, 0, pos.z);
    hero.heading = hero.targetHeading = pos.heading;
    hero.collide(world); // на случай, если огород поменялся
  }
}
if (saved?.view) {
  cameraControl.setTurn(saved.view.turn || 0, hero.position);
  cameraControl.toggleCloseUp(!!saved.view.closeUp);
}
cameraControl.centerOn(hero.position); // на телефоне сцена ближе — начинаем с героя
refresh();

// Обновить картинку и интерфейс по состоянию игры и сохранить — после любого изменения
function refresh() {
  if (hero.held !== game.state.held) hero.setHeld(game.state.held);
  basket.userData.fill.visible = game.hasHarvest();
  ui.render({ ...game.view(), closeUp: cameraControl.isCloseUp });
  save();
}

// ---------- Сохранение ----------
// Всё, что сохраняем (в браузер и в файл): огород, монеты, семена, где стоит герой, ракурс камеры
function snapshot() {
  return { ...game.toSave(), hero: { x: hero.position.x, z: hero.position.z, heading: hero.heading },
    view: { turn: cameraControl.turn, closeUp: cameraControl.isCloseUp } };
}

function save() {
  // до стартового экрана и пока он открыт ещё не играем — нечего сохранять
  if (restarting || !menu || menu.isStart) return;
  saveGame(snapshot());
}

// Перезапуск страницы сразу в игру, без стартового экрана (после «Новой игры» и загрузки файла)
const SKIP_INTRO = 'ogorod2-skip-intro';
function reloadIntoGame() {
  restarting = true;
  try {
    sessionStorage.setItem(SKIP_INTRO, '1');
  } catch { /* не страшно: просто покажется стартовый экран */ }
  location.reload();
}

// Только для проверки (панель G): всё посаженное — сразу спелое
function ripenAll() {
  for (const cell of game.garden.cells) if (cell.plant) cell.wateredAt = 1;
  refresh();
}

function restart() {
  clearSave();
  reloadIntoGame();
}

// ---------- Меню и стартовый экран ----------
menu = createMenu({
  engine: sound.engine,
  hasSave: !!saved,
  savedAt: saved?.savedAt,
  snapshot: () => packSave(snapshot()),
  onNewGame: restart,
  onLoad(data) {
    storeSave(data); // игра прочитает его при перезапуске, рост досчитается по часам
    reloadIntoGame();
  },
  onOpenChange(open) {
    input.enabled = !open; // пока открыто меню, герой стоит
    if (!open) save();
  },
});

// При закрытии/сворачивании вкладки и раз в 5 секунд — на всякий случай
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', save);
setInterval(save, 5000);

// ---------- Управление ----------
// Клетка, с которой работает герой: грядка под ним; корзинка — если стоит к ней лицом (на неё не встать)
function actionCell() {
  const front = worldToCell(hero.frontPoint);
  if (isBasket(front)) return front;
  const c = worldToCell(hero.position);
  return isInGarden(c) ? c : null;
}

const input = createInput(renderer.domElement, camera, {
  // Клик по клетке: идём на неё и действуем. К корзинке — встаём рядом лицом к ней.
  onCellClick(c) {
    const toBasket = isBasket(c);
    const from = worldToCell(hero.position);
    const path = toBasket ? findPathToNeighbor(from, c) : findPathTo(from, c);
    if (!path) return;
    const points = path.map((p) => cellToWorld(p.x, p.z));
    if (points.length > 1) points.shift(); // первая точка — клетка, где герой уже стоит
    hero.walkPath(points, toBasket ? cellToWorld(c.x, c.z) : null, () => game.useTool(c));
  },
  onAction() {
    const c = actionCell();
    if (c) game.useTool(c);
  },
  onPan(dx, dy) {
    cameraControl.panBy(dx, dy);
  },
  onTool(n) {
    if (n === 4) toggleShop();
    else if (TOOLS[n - 1]) selectTool(TOOLS[n - 1].id);
  },
}, [{ object: basket, cell: BASKET_CELL }]);

// Стартовый экран при заходе на сайт (кроме перезапуска после «Новой игры» и загрузки файла)
let skipIntro = false;
try {
  skipIntro = sessionStorage.getItem(SKIP_INTRO) === '1';
  sessionStorage.removeItem(SKIP_INTRO);
} catch { /* нет доступа — показываем стартовый экран */ }
if (!skipIntro) menu.showStart();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (menu.isOpen) menu.close();
    else if (game.state.shopOpen) toggleShop(false);
    else menu.open();
  }
  if (menu.isOpen) return; // в меню клавиши игры не работают
  if (e.code === 'KeyM') sound.engine.toggle('music');   // M — музыка
  if (e.code === 'KeyN') sound.engine.toggle('effects'); // N — звуки
  if (e.repeat) return;
  if (e.code === 'KeyZ') toggleCloseUp();                 // Z — крупный план
  if (e.code === 'KeyQ') rotateWorld(-1);                 // Q / E — повернуть мир
  if (e.code === 'KeyE') rotateWorld(1);
});

// ---------- Игровой цикл ----------
// Где растут спелые светящиеся грибы — над ними поднимаются споры
function ripeMushrooms() {
  return game.garden.cells
    .filter((c) => c.plant === 'mushroom' && game.garden.stage(c) === RIPE)
    .map((c) => cellToWorld(c.x, c.z));
}

// Показать подсветку на клетке (или спрятать)
function placeOn(object, cell) {
  object.visible = !!cell;
  if (cell) {
    const p = cellToWorld(cell.x, cell.z);
    object.position.x = p.x;
    object.position.z = p.z;
  }
}

// Отсвет неба и растворение в дымке — всем материалам (и новым, например растениям) раз в секунду
applySkyReflex(scene);
let frameCount = 0;

let last = performance.now();
let daytimeFrame = 0;
let shownLamps = -1;
ui.setDaytime(daytime.phase());
renderer.setAnimationLoop((now) => {
  if (++frameCount % 60 === 0) applySkyReflex(scene);
  const dt = Math.min((now - last) / 1000, 0.05); // не больше 1/20 с, чтобы не «прыгал» после паузы
  last = now;

  hero.update(dt, input.getMoveDir(), world);
  cameraControl.update(dt, now / 1000, hero.position);
  gardenView.update();
  decor.update(dt, now / 1000);
  weather.update(dt, decor.wind);
  if (!menu.isOpen) { // время и ночные набеги идут только в игре (в меню и на стартовом экране — стоят)
    daytime.update(dt);
    night.update(dt);
    spirits.update(dt, now / 1000);
    attacks.update(dt);
    embers.update(dt, now / 1000, hero.position);
  }
  dayNight.update();
  lightRays.update(now / 1000, camera, { amount: dayNight.state.rays, moonlight: dayNight.state.moonlight });
  if (++daytimeFrame % 30 === 0) ui.setDaytime(daytime.phase());
  const { lamps, night: nightDepth } = dayNight.state;
  if (Math.abs(lamps - shownLamps) > 0.005) { // фонари и окна загораются к вечеру, гаснут утром
    shownLamps = lamps;
    setLampLevel(lamps);
  }
  decor.fireflyVisibility = (1 - weather.wetness) * lamps; // светлячки — вечером и ночью, в дождь прячутся
  effects.update(dt, { ripeMushrooms: ripeMushrooms(), visibility: 1 - weather.wetness, lamps });
  island.update(now / 1000);
  fogSea.update(dt, lamps);
  sound.update(dt, {
    heroPosition: hero.position,
    onSoil: isInGarden(worldToCell(hero.position)),
    windStrength: decor.windStrength,
    rain: weather.intensity,
    dark: lamps, // вечер и ночь: сверчки; ночь: сова и тихая музыка; утро и день: птицы
    night: nightDepth,
  });
  lanterns.update(now / 1000, lamps);

  placeOn(hoverFrame, input.hoverCell);
  placeOn(frontMarker, actionCell());

  pipeline.render(dt);
  devPanel?.tick(now);
});

// Только для разработки: доступ к игре из консоли браузера (game.restart() — начать заново)
if (import.meta.env.DEV) {
  window.game = {
    game, hero, camera, scene, restart, sound, quality, pipeline, renderer, weather, effects, decor, cameraControl, fogSea, daytime, dayNight, night, spirits, embers, attacks,
    // крупный план: game.closeUp(x, y, z, ширина) ; game.closeUp() — вернуть обычный вид
    closeUp(x, y, z, size) { cameraControl.closeUp(x === undefined ? null : new THREE.Vector3(x, y, z), size); },
    garden: game.garden,
    cheat(extraCoins = 1000) { game.addCoins(extraCoins); },
  };
}
