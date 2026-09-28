// Точка входа: собираем правила игры (game.js), картинку и управление, запускаем игровой цикл.
import * as THREE from 'three';
import { HERO_START, BASKET_CELL, PLANTS } from './config.js';
import { cellToWorld, worldToCell, isInGarden, findPathToNeighbor } from './grid.js';
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
import { applySkyReflex } from './render/sky-reflex.js';
import { createDevPanel, loadFxSettings } from './render/devpanel.js';
import { loadGame, saveGame, clearSave } from './save.js';
import { createSound } from './audio/index.js';

const quality = detectQuality();
setTextureLimit(quality.textureSize); // на слабом качестве картинки уменьшаются при загрузке
const { renderer, scene, camera, cameraControl, world, basket, landmarks, island } = createScene(document.body);
const lighting = createLighting(renderer, scene, quality, landmarks.island); // тени — только над ровной серединой острова
const lanterns = createLanterns(scene, quality);
const effects = createEffects(scene, quality, lanterns.positions);
const weather = createWeather(scene, quality, lighting, landmarks.island);
const fx = loadFxSettings(quality);
const pipeline = createPipeline(renderer, scene, camera, fx, quality);
// Панель настройки (G) — только при разработке; в опубликованной игре её нет
const sound = createSound();
const devPanel = import.meta.env.DEV ? createDevPanel(fx, pipeline, quality, weather, sound.engine, () => hero) : null;

// ---------- Правила ----------
let restarting = false; // во время «начать заново» не сохраняем
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
  sound: sound.engine,
});

// Загрузка сохранения. Растения «досчитываются» сами: стадия считается от момента полива.
const saved = loadGame();
if (saved) {
  game.load(saved);
  const pos = saved.hero || saved.hero; // в старых сохранениях место героя записано как «hero»
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
function save() {
  if (restarting) return;
  saveGame({ ...game.toSave(), hero: { x: hero.position.x, z: hero.position.z, heading: hero.heading },
    view: { turn: cameraControl.turn, closeUp: cameraControl.isCloseUp } });
}

function restart() {
  restarting = true;
  clearSave();
  location.reload();
}

// При закрытии/сворачивании вкладки и раз в 5 секунд — на всякий случай
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', save);
setInterval(save, 5000);

// ---------- Управление ----------
// Клетка перед носом героя
function frontCell() {
  const c = worldToCell(hero.frontPoint);
  return isInGarden(c) || isBasket(c) ? c : null;
}

const input = createInput(renderer.domElement, camera, {
  // Клик по клетке: идём к ней, встаём рядом лицом к ней и действуем
  onCellClick(c) {
    const path = findPathToNeighbor(worldToCell(hero.position), c);
    if (!path) return;
    const points = path.map((p) => cellToWorld(p.x, p.z));
    if (points.length > 1) points.shift(); // первая точка — клетка, где герой уже стоит
    hero.walkPath(points, cellToWorld(c.x, c.z), () => game.useTool(c));
  },
  onAction() {
    const c = frontCell();
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

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game.state.shopOpen) toggleShop(false);
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
renderer.setAnimationLoop((now) => {
  if (++frameCount % 60 === 0) applySkyReflex(scene);
  const dt = Math.min((now - last) / 1000, 0.05); // не больше 1/20 с, чтобы не «прыгал» после паузы
  last = now;

  hero.update(dt, input.getMoveDir(), world);
  cameraControl.update(dt, now / 1000, hero.position);
  gardenView.update();
  decor.update(dt, now / 1000);
  weather.update(dt, decor.wind);
  decor.fireflyVisibility = 1 - weather.wetness; // в дождь светлячки прячутся
  effects.update(dt, { ripeMushrooms: ripeMushrooms(), visibility: 1 - weather.wetness });
  island.update(now / 1000);
  sound.update(dt, {
    heroPosition: hero.position,
    onSoil: isInGarden(worldToCell(hero.position)),
    windStrength: decor.windStrength,
    rain: weather.intensity,
  });
  lanterns.update(now / 1000);

  placeOn(hoverFrame, input.hoverCell);
  placeOn(frontMarker, frontCell());

  pipeline.render(dt);
  devPanel?.tick(now);
});

// Только для разработки: доступ к игре из консоли браузера (game.restart() — начать заново)
if (import.meta.env.DEV) {
  window.game = {
    game, hero, camera, scene, restart, sound, quality, pipeline, renderer, weather, effects, decor, cameraControl,
    // крупный план: game.closeUp(x, y, z, ширина) ; game.closeUp() — вернуть обычный вид
    closeUp(x, y, z, size) { cameraControl.closeUp(x === undefined ? null : new THREE.Vector3(x, y, z), size); },
    garden: game.garden,
    cheat(extraCoins = 1000) { game.addCoins(extraCoins); },
  };
}
