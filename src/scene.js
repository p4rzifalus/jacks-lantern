// Сцена: камера, свет, земля, огород, домик, корзинка, подсветки клеток.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, CELL_SIZE, BASKET_CELL, MIN_CELL_PX, CAMERA } from './config.js';
import { cellToWorld } from './grid.js';
import { createIsland } from './island.js';
import { glowMaterial } from './render/glow.js';
import { getMaterial, mapTextures } from './art/assets.js';
import { mergeStatic } from './render/merge.js';
import { setViewYaw } from './render/view-angle.js';

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const TOOLBAR_SPACE = 160; // сколько точек снизу занимают панель инструментов и ряд семян

// Какой цвет каким материалом рисуется: стены — доски, крыша — черепица, дерево — с волокнами…
// Остальные цвета — гладкий материал без текстуры.
const wood = (color) => () => getMaterial('wood', { tint: color });
const SURFACES = {
  [COLORS.houseWalls]: () => getMaterial('planks'),
  [COLORS.houseRoof]: () => getMaterial('roof'),
  [COLORS.houseStep]: () => getMaterial('stone'),
  [COLORS.basket]: () => getMaterial('wicker'),
  [COLORS.houseTrim]: wood(COLORS.houseTrim),
  [COLORS.houseDoor]: wood(COLORS.houseDoor),
  [COLORS.houseShutters]: wood(COLORS.houseShutters),
  [COLORS.barrel]: wood(COLORS.barrel),
  [COLORS.logs]: wood(COLORS.logs),
};
const mat = (color) => SURFACES[color]?.() ?? new THREE.MeshStandardMaterial({ color, roughness: 0.85 });


// Кубик с тенями, поставленный на пол (y — высота низа)
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);

  // Изометрическая камера: смотрит по диагонали сверху, без перспективы.
  // Её можно повернуть вокруг острова на 90° (4 положения) — см. cameraControl.rotate.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const CAMERA_HEIGHT = 20;
  const CAMERA_DISTANCE = 20 * Math.SQRT2; // по земле от центра — как у точки (20, 20, 20)
  function placeCamera(yaw) {
    camera.position.set(Math.sin(yaw) * CAMERA_DISTANCE, CAMERA_HEIGHT, Math.cos(yaw) * CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    setViewYaw(yaw); // спрайты разворачиваются к камере
  }
  const yawOf = (turn) => Math.PI / 4 + (turn * Math.PI) / 2; // turn — 0…3, сколько раз повернули мир
  placeCamera(yawOf(0));

  // Свет — в render/lighting.js (вечер) и world/lanterns.js (фонари)

  // Размеры: огород + дорожка вокруг в одну клетку
  const half = (GARDEN_SIZE / 2 + 1) * CELL_SIZE;   // край дорожки
  const houseZ = -half - 1.5 * CELL_SIZE;            // домик за дорожкой

  // Остров: ровная середина под огородом, дорожкой и домиком, вокруг — неровные края
  const islandMinZ = houseZ - 1.5 * CELL_SIZE;
  const core = { minX: -half - 0.3, maxX: half + 0.3, minZ: islandMinZ, maxZ: half + 0.3 };
  const island = createIsland(scene, core);

  const houseX = 0.5;
  scene.add(createHouse(houseX, houseZ));
  const basketPos = cellToWorld(BASKET_CELL.x, BASKET_CELL.z);
  const basket = createBasket(basketPos.x, basketPos.z);
  scene.add(basket);

  // Где герой может ходить и во что упирается
  const world = {
    bounds: { min: -half + 0.25, max: half - 0.25 },
    obstacles: [{ x: basketPos.x, z: basketPos.z, r: 0.45 }],
  };

  // Камера: вся сцена целиком, если помещается. На узком экране — ближе
  // (клетка не меньше пальца), и тогда сцену можно двигать драгом.
  const sceneBox = new THREE.Box3(
    new THREE.Vector3(core.minX - 1, -0.6, core.minZ - 1),
    new THREE.Vector3(core.maxX + 1, 3.3, core.maxZ + 1),
  );
  // Границы сцены в координатах экрана камеры — пересчитываем после каждого поворота
  const sceneRect = new THREE.Box3();
  function measureScene() {
    sceneRect.makeEmpty();
    for (const x of [sceneBox.min.x, sceneBox.max.x])
      for (const y of [sceneBox.min.y, sceneBox.max.y])
        for (const z of [sceneBox.min.z, sceneBox.max.z])
          sceneRect.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    sceneRect.expandByScalar(0.4); // поля
  }
  measureScene();
  const CELL_WIDTH_IN_VIEW = CELL_SIZE * Math.SQRT2; // ширина ромбика клетки

  const view = { scale: 1, center: sceneRect.getCenter(new THREE.Vector3()) }; // scale — точек экрана на единицу сцены
  const toView = (worldPos) => worldPos.clone().applyMatrix4(camera.matrixWorldInverse); // точка сцены → координаты экрана камеры

  // Крупный план: zoom плавно идёт от 1 к CAMERA.closeUpZoom и обратно
  let closeUp = false;
  let zoom = 1;
  let pinch = 1; // щипок двумя пальцами (телефон): своё приближение поверх обычного вида
  const scaleNow = () => view.scale * zoom * pinch;

  // Поворот мира: turn — куда повернули (0…3), yaw — угол камеры сейчас (во время поворота — между точками)
  let turn = 0;
  let yaw = yawOf(0);
  let targetYaw = yaw; // куда поворачиваемся (всегда ровно одна из 4 точек)
  let turning = null; // { from, to, t, focus } — идёт поворот; focus — точка земли, которая остаётся в центре экрана

  // Держим видимую область в пределах сцены
  function clampCenter() {
    const halfW = window.innerWidth / 2 / scaleNow();
    const halfH = freeHeight() / 2 / scaleNow();
    const clampAxis = (value, min, max, half) => (max - min <= half * 2 ? (min + max) / 2 : Math.min(max - half, Math.max(min + half, value)));
    view.center.x = clampAxis(view.center.x, sceneRect.min.x, sceneRect.max.x, halfW);
    view.center.y = clampAxis(view.center.y, sceneRect.min.y, sceneRect.max.y, halfH);
  }

  // Высота экрана над панелью инструментов
  const freeHeight = () => Math.max(window.innerHeight - TOOLBAR_SPACE, window.innerHeight * 0.5);

  const breath = new THREE.Vector2(); // «дыхание» камеры — мелкий сдвиг поверх основного положения
  let debugView = null;               // только для разработки: крупный план (см. cameraControl.closeUp)
  // Вступление новой игры: камера сама переезжает от кадра к кадру (см. cameraControl.shot).
  // { x, y, scale } — где сейчас, to — куда едет (null — обратно к обычному виду, потом story = null)
  let story = null;

  function applyView() {
    clampCenter();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const base = debugView || story || { x: view.center.x, y: view.center.y, scale: scaleNow() };
    const scale = base.scale;
    const cx = base.x + breath.x / zoom;
    const cy = base.y + breath.y / zoom;
    const halfW = w / 2 / scale;
    const top = cy + freeHeight() / 2 / scale;
    Object.assign(camera, {
      left: cx - halfW, right: cx + halfW,
      top, bottom: top - h / scale,
    });
    camera.updateProjectionMatrix();
  }

  // Масштаб «вся сцена на экране»
  function wholeSceneScale() {
    const size = sceneRect.getSize(new THREE.Vector3());
    return Math.min(window.innerWidth / size.x, freeHeight() / size.y);
  }
  // Обычный масштаб: на телефоне — не мельче пальца и ещё ближе (CAMERA.phoneZoom)
  // (приближаем только на сенсорных экранах: мышью и в мелкую клетку попасть легко)
  function fitScale() {
    const fit = wholeSceneScale();
    return isTouch ? Math.max(fit, MIN_CELL_PX / CELL_WIDTH_IN_VIEW) * CAMERA.phoneZoom : fit;
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    view.scale = fitScale();
    applyView();
  }
  resize();
  window.addEventListener('resize', resize);

  // Точка земли в центре экрана (чтобы при повороте она осталась на месте)
  function groundAtCenter() {
    const ray = new THREE.Ray(
      new THREE.Vector3(view.center.x, view.center.y, 0).applyMatrix4(camera.matrixWorld),
      camera.getWorldDirection(new THREE.Vector3()),
    );
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()) ?? new THREE.Vector3();
  }

  // Поставить камеру под угол a, сохранив точку focus в центре экрана.
  // scale — масштаб (во время поворота задаём сами, чтобы мир не «дышал»), иначе — по размеру сцены
  function setYaw(a, focus, scale) {
    yaw = a;
    placeCamera(a);
    measureScene();
    view.scale = scale ?? fitScale();
    const p = toView(focus);
    view.center.set(p.x, p.y, 0);
  }

  let lastPan = -Infinity; // когда игрок последний раз двигал сцену пальцем
  let followed = false;    // телефон: камера уже встала на героя (в первый раз — сразу, без переезда)

  const cameraControl = {
    // Сдвинуть сцену вслед за пальцем (в точках экрана). В крупном плане камера держит героя — не двигаем.
    panBy(dxPx, dyPx) {
      if (closeUp) return;
      view.center.x -= dxPx / scaleNow();
      view.center.y += dyPx / scaleNow();
      lastPan = performance.now();
      applyView();
    },

    // Щипок двумя пальцами: factor — во сколько раз ближе (меньше 1 — дальше); (sx, sy) — точка экрана между пальцами,
    // она остаётся на месте. Отдалить — до всего острова, приблизить — до CAMERA.pinchMax от обычного вида
    zoomAt(factor, sx, sy) {
      if (closeUp || turning || story) return;
      const s0 = scaleNow();
      pinch = Math.min(CAMERA.pinchMax, Math.max(wholeSceneScale() / view.scale, pinch * factor));
      const s1 = scaleNow();
      const half = freeHeight() / 2;
      const x = view.center.x + (sx - window.innerWidth / 2) / s0; // точка сцены под пальцами
      const y = view.center.y + (half - sy) / s0;
      view.center.x = x - (sx - window.innerWidth / 2) / s1;
      view.center.y = y - (half - sy) / s1;
      lastPan = performance.now();
      applyView();
    },

    // Каждый кадр: поворот и приближение; лёгкое покачивание камеры;
    // в крупном плане — держим героя в центре; на телефоне — мягко догнать героя, если он ушёл к краю
    update(dt, time, followPos) {
      if (turning) {
        turning.t = Math.min(1, turning.t + (CAMERA.rotateTime > 0 ? dt / CAMERA.rotateTime : 1));
        const t = turning.t;
        const e = t * t * t * (t * (t * 6 - 15) + 10); // очень мягкий разгон и остановка
        // масштаб плавно идёт от начального к конечному — без отъезда на полпути
        const scale = turning.fromScale + (turning.toScale - turning.fromScale) * e;
        setYaw(turning.from + (turning.to - turning.from) * e, turning.focus, scale);
        if (turning.t >= 1) turning = null;
      }

      // Крупный план — от вида «вся сцена», поэтому на телефоне (где и так ближе) герой того же размера
      // во время поворота приближение не пересчитываем — иначе оно тоже «гуляет»
      const zoomTarget = turning ? zoom : closeUp ? Math.max(1.25 / pinch, (wholeSceneScale() * CAMERA.closeUpZoom) / (view.scale * pinch)) : 1;
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 6);
      if (Math.abs(zoomTarget - zoom) < 0.001) zoom = zoomTarget;

      breath.set(Math.sin(time * 0.37) * CAMERA.breath, Math.sin(time * 0.23 + 1) * CAMERA.breath * 0.6);
      if (closeUp && followPos && !turning) {
        const p = toView(followPos.clone().setY(followPos.y + 0.3)); // центр — на уровне груди героя
        if (isTouch) p.y += ((CAMERA.phoneHeroY - 0.5) * freeHeight()) / scaleNow(); // на телефоне герой чуть ниже середины
        const k = Math.min(1, dt * 5);
        view.center.x += (p.x - view.center.x) * k;
        view.center.y += (p.y - view.center.y) * k;
      }
      const canFollow = !closeUp && isTouch && CAMERA.followOnPhone && followPos && performance.now() - lastPan > 3000;
      if (canFollow) {
        // герой — не в середине, а чуть ниже (CAMERA.phoneHeroY): впереди, над ним, видно больше
        const s = scaleNow();
        const p = toView(followPos);
        const goalY = p.y + ((CAMERA.phoneHeroY - 0.5) * freeHeight()) / s;
        const dx = p.x - view.center.x;
        const dy = goalY - view.center.y;
        if (!followed) { // первый кадр игры — сразу на героя
          followed = true;
          view.center.x += dx;
          view.center.y += dy;
        } else {
          const halfW = (window.innerWidth / 2 / s) * CAMERA.phoneCalm; // «спокойная зона»
          const halfH = (freeHeight() / 2 / s) * CAMERA.phoneCalm;
          const k = Math.min(1, dt * 2.5);
          if (Math.abs(dx) > halfW) view.center.x += (dx - Math.sign(dx) * halfW) * k;
          if (Math.abs(dy) > halfH) view.center.y += (dy - Math.sign(dy) * halfH) * k;
        }
      }
      if (story) { // вступление: плавно едем к кадру (масштаб — тоже плавно, «в разах», а не в точках)
        const to = story.to || { x: view.center.x, y: view.center.y, scale: scaleNow() };
        const k = 1 - Math.exp(-dt * CAMERA.storySpeed * 2);
        story.x += (to.x - story.x) * k;
        story.y += (to.y - story.y) * k;
        story.scale *= Math.pow(to.scale / story.scale, k);
        const arrived = Math.abs(to.x - story.x) + Math.abs(to.y - story.y) < 0.02 && Math.abs(to.scale / story.scale - 1) < 0.01;
        if (!story.to && arrived) story = null;
      }
      applyView();
    },

    // Кадр вступления: камера едет к точке сцены; size — сколько единиц сцены помещается по короткой стороне экрана.
    // instant — сразу, без переезда. Без точки — вернуться к обычному виду
    shot(worldPos, size = 6, instant = false) {
      if (!worldPos) {
        if (story) story.to = null;
        return;
      }
      const p = toView(worldPos);
      const to = { x: p.x, y: p.y, scale: Math.min(window.innerWidth, window.innerHeight) / size };
      if (instant || !story) story = instant ? { ...to } : { x: view.center.x, y: view.center.y, scale: scaleNow() };
      story.to = to;
      applyView();
    },
    get inStory() { return !!story; },

    // Повернуть мир на 90°: +1 — по часовой стрелке, −1 — против. focusPos — что держать в центре (герой)
    rotate(step, focusPos) {
      turn = (turn + step + 4) % 4;
      targetYaw += step * (Math.PI / 2); // камера идёт вокруг острова — мир на экране крутится по часовой
      const focus = turning?.focus ?? (closeUp && focusPos ? focusPos.clone().setY(0) : groundAtCenter());
      // масштаб в конце поворота: ненадолго ставим камеру в конечную точку и меряем сцену
      const from = yaw;
      placeCamera(targetYaw);
      measureScene();
      const toScale = fitScale();
      placeCamera(from);
      measureScene();
      turning = { from, to: targetYaw, t: 0, focus, fromScale: view.scale, toScale };
    },
    // Сразу поставить нужный поворот (при загрузке сохранения)
    setTurn(n, focusPos) {
      turn = ((n % 4) + 4) % 4;
      turning = null;
      targetYaw = yawOf(turn);
      setYaw(targetYaw, focusPos ?? groundAtCenter());
      applyView();
    },
    get turn() { return turn; },

    // Крупный план героя: вкл/выкл (или задать явно)
    toggleCloseUp(on = !closeUp) {
      closeUp = on;
    },
    get isCloseUp() { return closeUp; },

    // Только для разработки: крупный план точки сцены (size — сколько единиц по ширине экрана); null — вернуть
    closeUp(worldPos, size = 6) {
      if (!worldPos) { debugView = null; applyView(); return; }
      const p = toView(worldPos);
      debugView = { x: p.x, y: p.y - freeHeight() / 2 / (window.innerWidth / size) + window.innerHeight / 2 / (window.innerWidth / size), scale: window.innerWidth / size };
      applyView();
    },
    // Поставить точку сцены в центр экрана
    centerOn(worldPos) {
      const p = toView(worldPos);
      view.center.set(p.x, p.y, 0);
      applyView();
    },
  };

  // Места для мелких деталей: дым из трубы, флюгер на коньке крыши, края острова
  const landmarks = {
    chimneyTop: new THREE.Vector3(houseX + 0.8, 2.55, houseZ - 0.3),
    roofPeak: new THREE.Vector3(houseX, 2.6, houseZ + 1.0),
    island: core,
    house: { minX: houseX - 1.8, maxX: houseX + 2.4, minZ: houseZ - 1.3, maxZ: houseZ + 1.4 },
  };

  return { renderer, scene, camera, cameraControl, world, basket, landmarks, island };
}

function createHouse(x, z) {
  const house = new THREE.Group();
  const w = 3 * CELL_SIZE, d = 2 * CELL_SIZE, h = 1.5;
  house.add(box(w, h, d, COLORS.houseWalls));

  // Крыша-треугольник, фронтон смотрит на огород
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.2, 0);
  shape.lineTo(w / 2 + 0.2, 0);
  shape.lineTo(0, 1.1);
  shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false });
  roofGeo.translate(0, h, -(d + 0.3) / 2);
  const roof = new THREE.Mesh(roofGeo, mat(COLORS.houseRoof));
  roof.castShadow = true;
  house.add(roof);

  const front = d / 2;

  // Брёвна-стойки по углам и балка под крышей
  for (const [cx, cz] of [[-w / 2, front], [w / 2, front], [w / 2, -front], [-w / 2, -front]]) {
    house.add(box(0.12, h, 0.12, COLORS.houseTrim, cx, 0, cz));
  }
  house.add(box(w + 0.1, 0.1, 0.1, COLORS.houseTrim, 0, h - 0.1, front + 0.02));
  house.add(box(0.1, 0.1, d + 0.1, COLORS.houseTrim, w / 2 + 0.02, h - 0.1, 0));

  // Дверь: наличник, ручка, ступенька и козырёк
  house.add(box(0.74, 1.04, 0.05, COLORS.houseTrim, -0.5, 0, front));
  house.add(box(0.6, 0.95, 0.06, COLORS.houseDoor, -0.5, 0, front + 0.01));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(COLORS.houseAccent));
  knob.position.set(-0.32, 0.48, front + 0.06);
  house.add(knob);
  house.add(box(0.9, 0.08, 0.32, COLORS.houseStep, -0.5, 0, front + 0.16));
  const awning = box(0.95, 0.06, 0.38, COLORS.houseRoof, -0.5, 1.08, front + 0.17);
  awning.rotation.x = 0.3;
  house.add(awning);

  // Крюк у двери: здесь днём спит фонарь Джек (его спрайт и свет — world/jack-hook.js)
  house.add(box(0.04, 0.2, 0.12, COLORS.houseTrim, -1.2, 0.95, front + 0.06));
  house.add(box(0.03, 0.03, 0.16, COLORS.houseTrim, -1.2, 1.1, front + 0.13));
  house.add(box(0.025, 0.05, 0.025, COLORS.houseTrim, -1.2, 1.05, front + 0.18));

  // Окно спереди: рама, переплёт крестом, ставни, ящик с цветами
  const windowWithFrame = (px, py, pz, alongX) => {
    const [fw, fd] = alongX ? [0.62, 0.05] : [0.05, 0.62];
    house.add(box(fw, 0.57, fd, COLORS.houseTrim, px, py - 0.06, pz));
    const [gw, gd] = alongX ? [0.5, 0.06] : [0.06, 0.5];
    const glass = box(gw, 0.45, gd, COLORS.houseWindow, px + (alongX ? 0 : 0.01), py, pz + (alongX ? 0.01 : 0));
    glass.material = glowMaterial(COLORS.houseWindow, 0.6, { lamp: true }); // тёплый свет изнутри (днём гаснет)
    house.add(glass);
    const [bw, bd] = alongX ? [0.04, 0.07] : [0.07, 0.04];
    house.add(box(bw, 0.45, bd, COLORS.houseTrim, px + (alongX ? 0 : 0.02), py, pz + (alongX ? 0.02 : 0)));
    const [hw, hd] = alongX ? [0.5, 0.07] : [0.07, 0.5];
    house.add(box(hw, 0.04, hd, COLORS.houseTrim, px + (alongX ? 0 : 0.02), py + 0.2, pz + (alongX ? 0.02 : 0)));
  };
  windowWithFrame(0.7, 0.55, front, true);
  house.add(box(0.18, 0.5, 0.05, COLORS.houseShutters, 0.3, 0.52, front + 0.02));
  house.add(box(0.18, 0.5, 0.05, COLORS.houseShutters, 1.1, 0.52, front + 0.02));
  house.add(box(0.62, 0.12, 0.16, COLORS.houseTrim, 0.7, 0.4, front + 0.08));
  for (const [fx, color] of [[0.5, COLORS.flower], [0.7, COLORS.flowerCenter], [0.9, COLORS.flower]]) {
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(color));
    bloom.position.set(fx, 0.57, front + 0.09);
    house.add(bloom);
  }

  // Окно сбоку
  windowWithFrame(w / 2, 0.6, 0.1, false);

  // Круглое окошко на фронтоне
  const attic = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12), glowMaterial(COLORS.lamp, 0.8, { lamp: true }));
  attic.rotation.x = Math.PI / 2;
  attic.position.set(0, h + 0.42, (d + 0.3) / 2);
  house.add(attic);
  const atticRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), mat(COLORS.houseTrim));
  atticRim.position.set(0, h + 0.42, (d + 0.3) / 2 + 0.03);
  house.add(atticRim);

  // Конёк крыши и труба с шапкой
  house.add(box(0.14, 0.12, d + 0.4, COLORS.houseTrim, 0, h + 1.04, 0));
  house.add(box(0.3, 0.7, 0.3, COLORS.houseStep, 0.8, h + 0.35, -0.3)); // труба — каменная
  house.add(box(0.4, 0.08, 0.4, COLORS.houseTrim, 0.8, h + 1.03, -0.3));

  // Сбоку: бочка и поленница
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 12), mat(COLORS.barrel));
  barrel.position.set(w / 2 + 0.35, 0.25, 0.65);
  barrel.castShadow = true;
  house.add(barrel);
  for (const hy of [0.1, 0.4]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.02, 4, 16), mat(COLORS.houseTrim));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(w / 2 + 0.35, hy, 0.65);
    house.add(hoop);
  }
  for (const [ly, lz] of [[0.09, -0.3], [0.09, -0.12], [0.09, 0.06], [0.25, -0.21], [0.25, -0.03], [0.41, -0.12]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8), mat(COLORS.logs));
    log.rotation.z = Math.PI / 2;
    log.position.set(w / 2 + 0.35, ly, lz - 0.2);
    log.castShadow = true;
    house.add(log);
  }

  mapTextures(house);
  mergeStatic(house); // ~70 деталей → по куску на материал
  house.position.set(x, 0, z);
  return house;
}

function createBasket(x, z) {
  const basket = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.4, 14), mat(COLORS.basket));
  body.position.y = 0.2;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), mat(COLORS.basketInside));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 0.401;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI), mat(COLORS.basket));
  handle.position.y = 0.4;
  handle.rotation.y = Math.PI / 4;
  for (const m of [body, handle]) m.castShadow = true;
  basket.add(body, inside, handle);

  // Урожай в корзинке — показывается, когда там что-то есть
  const fill = new THREE.Group();
  for (const [fx, fz] of [[-0.1, 0.05], [0.1, -0.05], [0, 0.12]]) {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(COLORS.basketFill));
    piece.position.set(fx, 0.42, fz);
    fill.add(piece);
  }
  fill.visible = false;
  basket.add(fill);
  basket.userData.fill = fill;
  mapTextures(basket);
  basket.position.set(x, 0, z);
  return basket;
}

// Рамка клетки под курсором
export function createHoverFrame() {
  const frame = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: COLORS.hoverFrame });
  const s = CELL_SIZE * 0.96, t = 0.06;
  for (const [w, d, x, z] of [[s, t, 0, (s - t) / 2], [s, t, 0, -(s - t) / 2], [t, s, (s - t) / 2, 0], [t, s, -(s - t) / 2, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), m);
    bar.position.set(x, 0.06, z);
    frame.add(bar);
  }
  frame.visible = false;
  return frame;
}

// Заливка клетки, с которой работает герой (под ним)
export function createFrontMarker() {
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL_SIZE * 0.86, CELL_SIZE * 0.86),
    new THREE.MeshBasicMaterial({ color: COLORS.frontCell, transparent: true, opacity: 0.45 }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.045;
  marker.visible = false;
  return marker;
}
