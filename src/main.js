// Точка входа: собираем правила игры (game.js), картинку и управление, запускаем игровой цикл.
import * as THREE from 'three';
import { HERO_START, BASKET_CELL, PLANTS, JACK } from './config.js';
import { cellToWorld, worldToCell, cellCoords, isInGarden, findPathTo, findPathToNeighbor } from './grid.js';
import { createGame, isBasket } from './game.js';
import { createScene, createHoverFrame, createFrontMarker } from './scene.js';
import { Hero } from './hero.js';
import { GardenView } from './world/garden-view.js';
import { createInput } from './input.js';
import { createUI, TOOLS } from './ui.js';
import { createPopups } from './popups.js';
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
import { applySkyReflex, patch as patchSkyReflex } from './render/sky-reflex.js';
import { createDevPanel, loadFxSettings } from './render/devpanel.js';
import { BENCH, BENCH_SCENE, createStats } from './render/bench.js';
import { loadGame, saveGame, clearSave, storeSave, packSave } from './save.js';
import { createMenu } from './menu.js';
import { createSound } from './audio/index.js';
import { createDaytime } from './daytime.js';
import { createDayNight } from './render/day-night.js';
import { setLampLevel } from './render/glow.js';
import { createNight } from './night.js';
import { createJack } from './jack.js';
import { morningLine } from './lines.js';
import { createEmbers } from './world/embers.js';
import { createAttacks } from './world/attacks.js';
import { createSpirits } from './world/spirits.js';
import { Sprite } from './render/sprites.js';
import { getSheets } from './world/sheets.js';
import { PLANT_ORDER, PLANT_FRAME } from './art/sprite-art.js';

const quality = detectQuality();
setTextureLimit(quality.textureSize); // на слабом качестве картинки уменьшаются при загрузке
const { renderer, scene, camera, cameraControl, world, basket, landmarks, island } = createScene(document.body);
// Замеры скорости: адрес ?stats — счётчик, ?stats=day|night|rain — эталонная сцена (render/bench.js)
const stats = BENCH ? createStats(renderer, quality.name) : null;
const lighting = createLighting(renderer, scene, quality, landmarks.island); // тени — только над ровной серединой острова
const lanterns = createLanterns(scene, quality);
const effects = createEffects(scene, quality, lanterns.positions);
const weather = createWeather(scene, quality, lighting, landmarks.island);
const fogSea = createFogSea(scene, quality, landmarks.island); // туман под островом и вокруг
const lightRays = createLightRays(scene, quality, lighting); // рассветные лучи и лунное пятно
const fx = loadFxSettings(quality);
const pipeline = createPipeline(renderer, scene, camera, fx, quality);
const daytime = createDaytime(); // часы суток: новая игра — с утра, дальше — с того же времени, что в сохранении
const dayNight = createDayNight({ renderer, scene, lighting, pipeline, weather, daytime }); // как выглядит время суток
// Панель настройки (G) — только при разработке; в опубликованной игре её нет
const sound = createSound();
// Фонарь Джек — рассказчик: реплики внизу экрана (тексты — lines.js)
const jack = createJack({ onType: () => sound.typeKey() });
const devPanel = import.meta.env.DEV ? createDevPanel(fx, pipeline, quality, weather, sound.engine, () => hero, fogSea, { daytime, dayNight, spawnSpirit: () => night.spawnNow(), ripenAll }) : null;

// ---------- Правила ----------
let restarting = false; // во время «начать заново» не сохраняем
let menu = null; // меню и стартовый экран (создаются ниже)
const game = createGame({
  // так нельзя: енот качает головой и думает значком (без слов)
  onRefuse(icon) {
    sound.deny();
    hero.shake();
    popups.think(icon, () => hero.headPoint);
    if (icon === 'bagEmpty') { // семена кончились — магазин зовёт
      ui.beckonShop();
      jack.first('noSeeds');
    }
  },
  onEffect(name, cell, extra) {
    const at = cellToWorld(cell.x, cell.z);
    if (name === 'unlocked') { // открылись новые семена: мешочек летит из корзины к магазину
      sound.unlocked();
      return ui.flySeedsToShop(popups.screenOf(at.setY(0.6)));
    }
    if (name === 'hybrid') return discovered(cell, extra); // скрещивание: extra — { type, first }
    if (name === 'seeds') return popups.float(at.setY(0.6), `+${extra}`, 'seeds'); // сухое растение оставило семена
    sound[name](extra); // при продаже: чем больше выручка, тем больше монеток звенит
    hero.playAction(); // герой наклоняется: сажает, поливает, собирает, кладёт в корзинку
    if (name === 'planted') effects.dirt(at);
    if (name === 'watered') effects.water(hero.frontPoint.lerp(hero.position, 0.4), at);
    if (name === 'harvested') effects.sparkle(at);
    if (name === 'sold') {
      jack.first('firstSale');
      effects.coins(at);
      popups.float(at.clone().setY(0.9), `+${extra}`, 'coin');
    }
  },
  onChange: refresh,
});

// ---------- Скрещивание: получилось семя гибрида ----------
// Вспышка и перезвон; если гибрид выведен впервые — через миг окно «новое растение»
function discovered(cell, { type, first }) {
  sound.hybrid(first);
  effects.discovery(cellToWorld(cell.x, cell.z), first);
  if (!first) popups.float(cellToWorld(cell.x, cell.z).setY(0.6), '+1', 'seeds');
  else jack.first('firstHybrid');
  if (first) setTimeout(() => menu.showDiscovery(discoveryCard(type)), 900);
}

// Картинка спелого растения из листа растений (для окна открытия и гербария), один раз на растение
const plantImages = {};
function plantImage(type) {
  if (!plantImages[type]) {
    const { frameW, frameH } = PLANT_FRAME;
    const canvas = document.createElement('canvas');
    canvas.width = frameW;
    canvas.height = frameH;
    canvas.getContext('2d').drawImage(getSheets().plants.material.map.image, 3 * frameW, PLANT_ORDER.indexOf(type) * frameH, frameW, frameH, 0, 0, frameW, frameH);
    plantImages[type] = canvas.toDataURL();
  }
  return plantImages[type];
}

// Окно открытия: картинка спелого растения и картинки родителей
function discoveryCard(type) {
  const p = PLANTS[type];
  return { name: p.name, image: plantImage(type), parents: p.hybrid.map(plantImage) };
}

// ---------- Картинка ----------
const gardenView = new GardenView(scene, game.garden);
const decor = createDecor(scene, landmarks);

const hero = new Hero();
hero.position.copy(cellToWorld(HERO_START.x, HERO_START.z));
hero.heading = hero.targetHeading = Math.PI; // смотрит на огород
scene.add(hero.object);

// ---------- Ночь: духи ----------
const ATTACK_SOUNDS = {
  whip: () => sound.plantWhip(), spark: () => sound.plantSpark(), wall: () => sound.plantThump(),
  beam: () => sound.plantBeam(), spores: () => sound.plantSpores(),
};
// Правила (кто, когда, что уносит) — night.js; как выглядят и летают — world/spirits.js
const night = createNight({
  game,
  daytime,
  // скоро придёт дух: в тумане у края острова проступает свечение и звучит «у-у»
  onWarn(from) {
    spirits.warn(from);
    sound.spiritAppear();
  },
  onSpawn(spirit) {
    spirits.add(spirit);
    if (spirit.kind === 'skeleton') jack.first('firstSkeleton');
    else if (spirit.kind === 'ghost') jack.first('firstGhost');
  },
  // растения бьют духов: как выглядит — world/attacks.js
  onAttack(event) {
    jack.first('plantHit');
    attacks.show(event);
    gardenView.strike(event.from); // растение замахивается и бьёт
    if (event.type === 'wall') for (const s of event.targets) spirits.knock(s, 0.5); // тыква отталкивает на полклетки
    ATTACK_SOUNDS[event.type]?.();
  },
  onHit(spirit) {
    attacks.hit(spirit);
    sound.spiritHit();
  },
  // дух унёс урожай или монеты: на этом месте остаётся светящийся след до полудня
  onStolen(spirit, loot) {
    jack.first('firstStolen');
    gardenView.trail(loot.crop ? spirit.target.cell : BASKET_CELL);
  },
  onMorning(summary) {
    spirits.dawn();
    embers.dawn(); // несобранные огоньки сами летят в счётчик
    jack.say(morningLine(summary)); // Джек подводит итог ночи
  },
});
// Огоньки от прогнанных духов: енот подбирает, проходя рядом
const embers = createEmbers(scene, {
  onCollect(at) {
    game.addEmbers(1);
    jack.first('firstEmber');
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
  onScared(spirit, at, from) {
    jack.first('firstScared');
    sound.spiritScared();
    if (from) effects.sparkle(cellToWorld(from.x, from.z));
    embers.add(at);
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
  if (open) game.toggleHerbarium(false);
  game.toggleShop(open);
}
function toggleHerbarium(open = !game.state.herbariumOpen) {
  if (open !== game.state.herbariumOpen) sound.shop(open);
  if (open) game.toggleShop(false);
  game.toggleHerbarium(open);
}
// Куда смотрит енот — по клеткам (для широкой лейки: ряд из 3 клеток — поперёк взгляда)
const heroFacing = () => ({ x: Math.sin(hero.heading), z: Math.cos(hero.heading) });

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

// Подсказки без слов над миром: пузырь мысли над енотом, всплывающие «+12»
const popups = createPopups(camera, renderer.domElement);

const ui = createUI({
  onSelectTool: selectTool,
  onSelectSeed(type) {
    sound.click();
    game.selectSeed(type);
  },
  onBuy(type, count) {
    if (game.buySeeds(type, count)) sound.buy();
  },
  onUpgrade(id) {
    if (game.buyUpgrade(id)) sound.buy();
  },
  onShopToggle: toggleShop,
  onHerbariumToggle: toggleHerbarium,
  plantImage,
  onCloseUp: toggleCloseUp,
  onRotate: rotateWorld,
  onMenu: () => menu.toggle(),
});

// Сохранение сделано до появления Джека: какие «первые события» игрок уже точно пережил
function alreadyKnown() {
  const { state } = game;
  const known = [];
  if (Object.keys(state.harvested).length) known.push('start', 'thirsty', 'firstRipe', 'basketFull', 'firstSale');
  if (state.nightsSeen > 0) known.push('evening', 'firstGhost', 'firstScared', 'firstEmber', 'plantHit', 'firstStolen');
  if (state.nightsSeen > 2) known.push('firstSkeleton');
  if (state.discovered.length) known.push('firstHybrid');
  if (state.upgrades.length) known.push('canUpgrade');
  return known;
}

// Загрузка сохранения. Растения «досчитываются» сами: стадия считается от момента полива.
const saved = BENCH_SCENE ? null : loadGame(); // в замере — временный огород, сохранение не трогаем
if (saved) {
  game.load(saved);
  if (saved.jack) jack.load(saved.jack);
  else jack.load(alreadyKnown()); // сохранение до Джека: то, что игрок уже прошёл, не объясняем
  const pos = saved.hero || saved.mole; // в старых сохранениях место героя записано как «mole»
  if (pos) {
    const num = (n) => (Number.isFinite(n) ? n : 0); // файл могли поправить руками
    hero.position.set(num(pos.x), 0, num(pos.z));
    hero.heading = hero.targetHeading = num(pos.heading);
    hero.collide(world); // на случай, если огород поменялся
  }
}
if (saved?.view) cameraControl.setTurn(saved.view.turn || 0, hero.position);
cameraControl.toggleCloseUp(saved?.view ? !!saved.view.closeUp : true); // новая игра — крупным планом
if (Number.isFinite(saved?.daytime)) daytime.time = saved.daytime;
cameraControl.centerOn(hero.position); // на телефоне сцена ближе — начинаем с героя
refresh();

// Обновить картинку и интерфейс по состоянию игры и сохранить — после любого изменения
function refresh() {
  const { tool, selectedSeed, carried } = game.state;
  hero.setHeld({ tool, seed: selectedSeed, carried: carried.map((item) => item.type) });
  basket.userData.fill.visible = game.hasHarvest();
  hero.setLanternReach(game.perks().lanternRadius);
  const view = game.view();
  gardenView.setBasketCall(view.carried.length >= view.capacity); // корзинка полна — большая корзина зовёт
  ui.render({ ...view, closeUp: cameraControl.isCloseUp });
  save();
}

// ---------- Сохранение ----------
// Всё, что сохраняем (в браузер и в файл): огород, монеты, семена, где стоит герой, ракурс камеры
function snapshot() {
  return { ...game.toSave(), jack: jack.toSave(), hero: { x: hero.position.x, z: hero.position.z, heading: hero.heading },
    view: { turn: cameraControl.turn, closeUp: cameraControl.isCloseUp }, daytime: daytime.time };
}

function save() {
  // до стартового экрана и пока он открыт ещё не играем — нечего сохранять
  if (restarting || !menu || menu.isStart || BENCH_SCENE) return;
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
  for (const cell of game.garden.cells) if (cell.plant) cell.plantedAt = cell.wateredAt = 1;
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
    if (open) hero.walkPath([], null); // и не доходит до клетки, по которой щёлкнули перед этим
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
    hero.walkPath(points, toBasket ? cellToWorld(c.x, c.z) : null, () => game.useTool(c, heroFacing()));
  },
  onAction() {
    const c = actionCell();
    if (c) game.useTool(c, heroFacing());
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
if (BENCH_SCENE) setupBenchScene(BENCH_SCENE);
else if (!skipIntro) menu.showStart();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (menu.isOpen) menu.close();
    else if (game.state.shopOpen) toggleShop(false);
    else if (game.state.herbariumOpen) toggleHerbarium(false);
    else menu.open();
  }
  if (menu.isOpen || e.repeat) return; // в меню клавиши игры не работают; зажатая клавиша срабатывает один раз
  if (e.code === 'KeyM') sound.engine.toggle('music');   // M — музыка
  if (e.code === 'KeyN') sound.engine.toggle('effects'); // N — звуки
  if (e.code === 'KeyZ') toggleCloseUp();                 // Z — крупный план
  if (e.code === 'KeyH') toggleHerbarium();               // H — гербарий
  if (e.code === 'KeyQ') rotateWorld(-1);                 // Q / E — повернуть мир
  if (e.code === 'KeyE') rotateWorld(1);
});

// ---------- Подсказки светом ----------
// В новой игре (огород пуст, ничего ещё не собирали) мягко светится ближайшая к еноту грядка — «начни здесь»
function guideCell() {
  const { harvested, carried } = game.state;
  if (carried.length || Object.keys(harvested).length || game.garden.cells.some((c) => c.plant)) return null;
  const at = cellCoords(hero.position);
  let best = null;
  let bestD = Infinity;
  for (const c of game.garden.cells) {
    if (isBasket(c)) continue;
    const d = Math.hypot(c.x - at.x, c.z - at.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}
// ---------- Эталонные сцены для замеров (адрес ?stats=day|night|rain) ----------
// Временный огород: все грядки спелые (разные растения), енот у корзины; сохранение не читается и не пишется
function setupBenchScene(kind) {
  const types = Object.keys(PLANTS);
  game.garden.cells.forEach((c, i) => {
    if (!isBasket(c)) Object.assign(c, { plant: types[i % types.length], plantedAt: 1, wateredAt: 1, nights: 0 });
  });
  hero.position.copy(cellToWorld(BASKET_CELL.x, BASKET_CELL.z + 2));
  const at = (id, share) => {
    const p = daytime.phases.find((ph) => ph.id === id);
    daytime.time = p.start + p.seconds * share;
    dayNight.refresh();
  };
  weather.setRain(kind === 'rain');
  if (kind === 'day') at('day', 0.3);
  if (kind === 'rain') at('evening', 0.6);
  if (kind === 'night') {
    // тяжёлая ночь: третья по счёту (духи со всех сторон) и ещё 20 духов сверху, по одному каждые четверть секунды
    game.state.nightsSeen = 3;
    at('night', 0.05);
    for (let i = 0; i < 20; i++) setTimeout(() => night.spawnNow(), 300 + i * 250);
  }
  game.addCoins(0); // обновить картинку огорода и интерфейс
}

// ---------- Когда говорит Джек ----------
// Раз в полсекунды проверяем, не случилось ли что-то впервые; и изредка — атмосферная реплика
let jackCheck = 0;
function watchForJack(dt) {
  const phase = daytime.phase().id;
  jack.ambient(weather.raining ? 'rain' : night.threat ? null : phase, dt);
  if ((jackCheck -= dt) > 0) return;
  jackCheck = 0.5;
  const { state, garden } = game;
  if (guideCell()) jack.first('start'); // новая игра: огород пуст
  const now = Date.now();
  if (garden.cells.some((c) => c.plant && garden.stage(c) === 0 && !garden.isWet(c) && now - c.plantedAt > JACK.thirstySeconds * 1000)) jack.first('thirsty');
  if (game.ripeCells().length) jack.first('firstRipe');
  const view = game.view();
  if (view.carried.length >= view.capacity) jack.first('basketFull');
  if (phase === 'evening') jack.first('evening');
  if (weather.raining) jack.first('rain');
  if (view.upgrades.some((b) => b.steps.some((st) => st.available && st.price <= state.embers))) jack.first('canUpgrade');
}

const GLINT_EVERY = 1.2; // раз во сколько секунд поблёскивает одно из спелых растений
let glintTimer = GLINT_EVERY;

// ---------- Игровой цикл ----------
// Где растут спелые светящиеся грибы — над ними поднимаются споры
function ripeMushrooms() {
  return game.garden.cells
    .filter((c) => c.plant === 'mushroom' && game.garden.isGuard(c))
    .map((c) => cellToWorld(c.x, c.z));
}

// Где летает пыльца: пары спелых соседей, из которых может выйти гибрид (пересчитываем раз в полсекунды)
let pollenPairs = [];
function updatePollen() {
  pollenPairs = game.crossPairs().map(([a, b]) => [cellToWorld(a.x, a.z), cellToWorld(b.x, b.z)]);
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

// Шейдеры — заранее, пока игра на стартовом экране. Иначе видеокарта готовит новую программу отрисовки прямо
// посреди игры (в первую ночь, у первого духа, при первой атаке) — и картинка дёргается.
// Рисуем по одному крошечному (невидимому глазу) образцу всего, что появляется только ночью, пару кадров — и убираем.
// А то, что сейчас спрятано (лунные лучи, конусы фонарей, дождь), готовим для всей сцены разом в первом кадре.
function warmUpShaders() {
  const sheets = getSheets();
  const group = new THREE.Group();
  group.scale.setScalar(1e-4);
  const sprite = (sheet, options) => {
    const s = new Sprite(sheet, { faceCamera: false, ...options });
    group.add(s.object);
    return s;
  };
  const spirit = sprite(sheets.spirits); // дух — со своим полупрозрачным материалом, как в world/spirits.js
  spirit.mesh.material = sheets.spirits.material.clone();
  spirit.mesh.material.transparent = true;
  patchSkyReflex(spirit.mesh.material);
  sprite(sheets.spirits, { castShadow: false }); // огонёк
  sprite(sheets.held, { castShadow: false });    // добыча у духа
  sprite(sheets.fx, { castShadow: false });      // искры и вспышки боя
  const glowMap = new THREE.CanvasTexture(document.createElement('canvas')); // как у свечений: картинка из кода
  const additive = { map: glowMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial(additive))); // свечение на земле (кольцо спор)
  const beamShape = new THREE.PlaneGeometry();
  beamShape.deleteAttribute('normal'); // луч подсолнуха — фигура без нормалей (world/attacks.js → coneGeometry)
  group.add(new THREE.Mesh(beamShape, new THREE.MeshBasicMaterial(additive)));
  group.add(new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, fog: false })));            // свечение в тумане перед духом
  for (const material of Object.values(gardenView.soil)) { // земля грядки: сухая, мокрая, со спелым урожаем
    const tile = new THREE.Mesh(new THREE.BoxGeometry(), material);
    tile.receiveShadow = true;
    group.add(tile);
  }
  group.traverse((o) => { o.frustumCulled = false; }); // рисовать, даже если середина острова не в кадре
  scene.add(group);
  applySkyReflex(scene); // вставка неба — сразу, иначе шейдер соберётся ещё раз
  let frames = 3;
  return () => {
    if (frames === 3) renderer.compile(scene, camera);
    if (frames > 0 && --frames === 0) scene.remove(group);
  };
}

// Отсвет неба и растворение в дымке — всем материалам (и новым, например растениям) раз в секунду
applySkyReflex(scene);
const warmUpTick = warmUpShaders();
let frameCount = 0;

let last = performance.now();
const screenRight = new THREE.Vector3(); // «вправо» на экране — в сцене
let daytimeFrame = 0;
let shownLamps = -1;
ui.setDaytime(daytime.phase());
renderer.setAnimationLoop(frame);
function frame(now) {
  if (++frameCount % 60 === 0) applySkyReflex(scene);
  const realDt = (now - last) / 1000; // настоящая длина кадра — для счётчика (рывки видно как есть)
  const dt = Math.min(realDt, 0.05); // не больше 1/20 с, чтобы не «прыгал» после паузы
  last = now;
  stats?.begin();

  hero.update(dt, input.getMoveDir(), world);
  cameraControl.update(dt, now / 1000, hero.position);
  // ночью, пока по огороду ходит дух, спелые растения настороже и тянутся к ближайшему
  gardenView.update(Date.now(), dt, night.threat, spirits.positions(), screenRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize());
  decor.update(dt, now / 1000);
  weather.update(dt, decor.wind);
  if (!menu.isOpen) { // время и ночные набеги идут только в игре (в меню и на стартовом экране — стоят)
    daytime.update(dt);
    if (weather.raining) game.rain(dt); // дождь мочит грядки
    night.update(dt, cellCoords(hero.position)); // фонарь енота пугает духов рядом
    hero.setLantern(hero.lanternLevel + ((night.active ? 1 : 0) - hero.lanternLevel) * Math.min(1, dt * 1.5)); // ночью фонарь разгорается
    spirits.update(dt, now / 1000);
    attacks.update(dt);
    embers.update(dt, now / 1000, hero.position, game.perks().emberPull ?? undefined);
  }
  popups.update(dt);
  jack.update(dt, menu.isOpen || game.state.shopOpen || game.state.herbariumOpen || !!BENCH_SCENE); // в замере Джек молчит
  if (!menu.isOpen && !BENCH_SCENE) watchForJack(dt);
  dayNight.update();
  lightRays.update(now / 1000, camera, { amount: dayNight.state.rays, moonlight: dayNight.state.moonlight });
  if (++daytimeFrame % 30 === 0) ui.setDaytime(daytime.phase());
  const { lamps, night: nightDepth } = dayNight.state;
  if (Math.abs(lamps - shownLamps) > 0.005) { // фонари и окна загораются к вечеру, гаснут утром
    shownLamps = lamps;
    setLampLevel(lamps);
  }
  gardenView.setShine(lamps); // мокрые грядки блестят при фонарях (каждый кадр: текстура могла догрузиться позже)
  decor.fireflyVisibility = (1 - weather.wetness) * lamps; // светлячки — вечером и ночью, в дождь прячутся
  if (frameCount % 30 === 0) updatePollen();
  if (frameCount % 20 === 0) gardenView.setGuide(guideCell());
  gardenView.pulse(now / 1000, menu.isOpen ? 0 : dt);
  glintTimer -= dt;
  if (glintTimer <= 0 && !menu.isOpen) { // днём спелые изредка поблёскивают
    glintTimer = GLINT_EVERY;
    const ripe = lamps < 0.5 ? game.ripeCells() : [];
    const c = ripe[Math.floor(Math.random() * ripe.length)];
    if (c) effects.glint(cellToWorld(c.x, c.z));
  }
  effects.update(dt, { ripeMushrooms: ripeMushrooms(), pollenPairs, visibility: 1 - weather.wetness, lamps });
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
  lanterns.update(now / 1000, lamps, [hero.position, ...spirits.positions()]);

  placeOn(hoverFrame, input.hoverCell);
  placeOn(frontMarker, actionCell());

  lighting.shadowTick(frameCount);
  pipeline.render(dt);
  stats?.end(realDt);
  warmUpTick();
  devPanel?.tick(now);
}

// Только для разработки: доступ к игре из консоли браузера (game.restart() — начать заново)
if (import.meta.env.DEV) {
  window.game = {
    game, hero, camera, scene, restart, sound, jack, quality, pipeline, renderer, weather, effects, decor, cameraControl, fogSea, daytime, dayNight, night, spirits, embers, attacks, gardenView,
    // крупный план: game.closeUp(x, y, z, ширина) ; game.closeUp() — вернуть обычный вид
    closeUp(x, y, z, size) { cameraControl.closeUp(x === undefined ? null : new THREE.Vector3(x, y, z), size); },
    garden: game.garden,
    cheat(extraCoins = 1000) { game.addCoins(extraCoins); },
    // прокрутить игру на seconds секунд кадрами по 1/30 с (когда вкладка в фоне и браузер кадры не даёт)
    run(seconds) {
      let t = performance.now();
      for (let i = 0; i < seconds * 30; i++) frame((t += 1000 / 30));
      last = performance.now();
    },
  };
}
