// Герой-огородник (енот или крот — скин): пиксельный спрайт с анимациями, ходит сам или по маршруту.
import * as THREE from 'three';
import { CELL_SIZE, HERO_SKIN, HERO_SPEED, HERO_TURN_SPEED, HERO_SCALE, HERO_REACH, LANTERN } from './config.js';
import { Sprite, PX, LAYER, layerOffset } from './render/sprites.js';
import { getSheets } from './world/sheets.js';
import { HERO, PLANT_ORDER, TOOL_FRAMES, SEED_BAG_ROW } from './art/sprite-art.js';
import { viewAngle } from './render/view-angle.js';

const RADIUS = 0.3 * HERO_SCALE; // «толщина» героя для столкновений
const FPS = { idle: 3, walk: 10, act: 10, carry: 10 }; // скорость анимаций, кадров в секунду
const ACT_TIME = HERO.anims.act[1] / FPS.act;         // сколько длится «действие»

// Куда герой смотрит относительно камеры → строка листа.
// «К зрителю» — это угол, под которым стоит камера (сначала 45°, после поворота мира — другой).
function directionOf(heading) {
  const rel = Math.atan2(Math.sin(heading - viewAngle.yaw), Math.cos(heading - viewAngle.yaw));
  if (Math.abs(rel) <= Math.PI / 4) return 'down';
  if (Math.abs(rel) >= (3 * Math.PI) / 4) return 'up';
  return rel > 0 ? 'right' : 'left';
}

// Где предмет в лапах: перед героем, а если он смотрит от нас — за ним
const HELD_OFFSET = {
  down: [0, 0.2, 0.03], left: [-0.22, 0.2, 0.03], right: [0.22, 0.2, 0.03], up: [0, 0.22, -0.03],
};

// Собранные овощи в корзинке: уменьшенные спрайты урожая, выглядывают над плетёным боком.
// Места — в пикселях от низа-середины корзинки; третий и дальше — видно только первые три
const CROP_SCALE = 0.55;
const CROP_SPOTS = [[-3, 5.5], [3, 6], [0, 7.5]];

// Пятно света фонаря на земле: мягко гаснет к краю — видно, докуда достаёт свет
function lanternRingTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Поворот на кратчайший угол
function turnTowards(current, target, maxStep) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return current + Math.max(-maxStep, Math.min(maxStep, diff));
}

const HERO_LAYER = layerOffset(LAYER.hero);

export class Hero {
  constructor(skin = HERO_SKIN) {
    const sheets = getSheets();
    this.sprite = new Sprite(sheets.hero[skin], { layer: LAYER.hero });
    this.skin = skin;
    this.object = new THREE.Group();
    this.object.add(this.sprite.object);
    // Что в лапах — в той же «повёрнутой к камере» плоскости, что и герой. Слои от дальнего к ближнему:
    // инструмент (или зад корзинки) → собранные овощи → перед корзинки
    this.hand = new THREE.Group();
    this.sprite.object.add(this.hand);
    this.toolSprite = new Sprite(sheets.tools, { faceCamera: false });
    this.crops = CROP_SPOTS.map(([x, y], i) => {
      const crop = new Sprite(sheets.held, { castShadow: false, faceCamera: false });
      crop.mesh.scale.setScalar(CROP_SCALE);
      crop.mesh.position.set(x * PX, y * PX, 0.004 + i * 0.001);
      this.hand.add(crop.mesh);
      return crop;
    });
    this.basketFront = new Sprite(sheets.tools, { faceCamera: false });
    this.basketFront.setFrame(...TOOL_FRAMES.basketFront);
    this.basketFront.mesh.position.z = 0.01;
    this.hand.add(this.toolSprite.mesh, this.basketFront.mesh);

    // Фонарь: ночью висит сбоку, светит вокруг (свет и круг на земле — с самого начала, днём погашены,
    // чтобы при зажигании ничего не пересобиралось)
    this.lantern = new Sprite(sheets.tools, { faceCamera: false, castShadow: false });
    this.lantern.setFrame(...TOOL_FRAMES.lantern);
    this.lantern.mesh.visible = false;
    this.sprite.object.add(this.lantern.mesh);
    this.lanternLight = new THREE.PointLight(LANTERN.color, 0, LANTERN.radius * CELL_SIZE * 2.2, 2);
    this.lanternLight.position.set(0, 0.6, 0);
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: lanternRingTexture(), color: LANTERN.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.ring.scale.setScalar(LANTERN.radius * CELL_SIZE);
    this.ring.position.y = 0.05;
    this.object.add(this.lanternLight, this.ring);
    this.lanternLevel = 0;
    this.object.scale.setScalar(HERO_SCALE);
    this.actTime = 0;         // сколько ещё показывать «действие»
    this.animTime = 0;
    this.heading = 0;        // куда смотрит сейчас (угол)
    this.targetHeading = 0;  // куда хочет повернуться
    this.walkTime = 0;
    this.path = [];          // точки маршрута после клика
    this.faceTo = null;      // куда повернуться в конце маршрута
    this.onArrive = null;
  }

  // Сменить облик: 'raccoon' или 'mole'. Кадры у всех скинов в одном порядке, поэтому меняем только картинку
  setSkin(skin) {
    const sheet = getSheets().hero[skin];
    if (!sheet) return;
    this.skin = skin;
    this.sprite.sheet = sheet;
    this.sprite.mesh.material = sheet.material;
    this.sprite.mesh.customDepthMaterial = sheet.depthMaterial;
    this.sprite.mesh.customDistanceMaterial = sheet.distanceMaterial;
  }

  // Что в лапах: выбранный инструмент. tool — 'seeds' | 'water' | 'basket', seed — какие семена в мешочке,
  // carried — что лежит в корзинке для сбора (видно, только когда она в лапах)
  setHeld({ tool, seed, carried }) {
    const basket = tool === 'basket';
    this.toolSprite.setFrame(...(TOOL_FRAMES[tool] || [Math.max(0, PLANT_ORDER.indexOf(seed)), SEED_BAG_ROW]));
    this.basketFront.mesh.visible = basket;
    this.crops.forEach((crop, i) => {
      const type = basket ? carried[i] : null;
      crop.mesh.visible = !!type;
      if (type) crop.setFrame(PLANT_ORDER.indexOf(type), 0);
    });
  }

  // Фонарь: level 0 — погашен (день), 1 — горит (ночь)
  setLantern(level) {
    this.lanternLevel = level;
    this.lanternLight.intensity = LANTERN.intensity * level;
    this.ring.material.opacity = LANTERN.ring * level * (0.9 + 0.1 * Math.sin(performance.now() / 180)); // чуть дышит, как огонь
    this.lantern.mesh.visible = level > 0.05;
  }

  // Показать короткое движение «сажаю / поливаю / собираю»
  playAction() {
    this.actTime = ACT_TIME;
    this.animTime = 0;
  }

  get position() {
    return this.object.position;
  }

  // Точка перед носом — по ней ищем «клетку перед героем»
  get frontPoint() {
    const d = CELL_SIZE * HERO_REACH;
    return this.position.clone().add(new THREE.Vector3(Math.sin(this.heading) * d, 0, Math.cos(this.heading) * d));
  }

  walkPath(points, faceTo, onArrive) {
    this.path = points;
    this.faceTo = faceTo;
    this.onArrive = onArrive || null;
  }

  // keyDir — направление с клавиатуры (или нулевой вектор)
  update(dt, keyDir, world) {
    const step = HERO_SPEED * CELL_SIZE * dt;
    const move = new THREE.Vector3();

    if (keyDir.lengthSq() > 0) {
      this.path = []; // клавиши отменяют маршрут
      this.onArrive = null;
      move.copy(keyDir).normalize().multiplyScalar(step);
    } else if (this.path.length) {
      const toTarget = this.path[0].clone().sub(this.position).setY(0);
      if (toTarget.length() <= step) {
        move.copy(toTarget);
        this.path.shift();
        if (!this.path.length) this.arrive();
      } else {
        move.copy(toTarget).setLength(step);
      }
    }

    const moving = move.lengthSq() > 1e-8;
    if (moving) {
      this.position.add(move);
      this.collide(world);
      this.targetHeading = Math.atan2(move.x, move.z);
    }

    this.heading = turnTowards(this.heading, this.targetHeading, HERO_TURN_SPEED * dt);

    // Какую анимацию показать и какой кадр
    // в лапах всегда инструмент: идёт — «несёт», стоит — первый кадр «несёт»
    const anim = this.actTime > 0 ? 'act' : 'carry';
    if (this.actTime > 0) this.actTime -= dt;
    if (anim !== this.anim) {
      this.anim = anim;
      this.animTime = 0;
    }
    this.animTime += dt;
    const [first, count] = HERO.anims[anim];
    const still = anim === 'carry' && !moving;
    const frame = still ? 0 : Math.floor(this.animTime * FPS[anim]) % count;
    const dir = directionOf(this.heading);
    this.sprite.setFrame(first + frame, HERO.dirs[dir]);

    // предмет в лапах покачивается вместе с шагом
    const [hx, hy, hz] = HELD_OFFSET[dir];
    const bob = moving && frame % 3 === 0 ? -0.03 : 0;
    this.hand.position.set(hx, hy + bob, hz).add(HERO_LAYER); // вместе с героем — в его слое
    // фонарь — с другой стороны от предмета в лапах, чуть покачивается на ходу
    this.lantern.mesh.position.set(dir === 'right' ? -0.24 : 0.24, 0.12 + bob * 0.5, dir === 'up' ? -0.03 : 0.03).add(HERO_LAYER);
    this.lantern.mesh.rotation.z = moving ? Math.sin(this.animTime * 9) * 0.15 : 0;
    this.hand.scale.x = dir === 'left' ? -1 : 1; // рисунки смотрят вправо (носик лейки), влево — зеркалим
  }

  arrive() {
    if (this.faceTo) {
      const d = this.faceTo.clone().sub(this.position);
      this.targetHeading = Math.atan2(d.x, d.z);
    }
    const cb = this.onArrive;
    this.onArrive = null;
    if (cb) cb();
  }

  // Не выходим за дорожку и не залезаем в корзинку
  collide(world) {
    const p = this.position;
    p.x = Math.max(world.bounds.min, Math.min(world.bounds.max, p.x));
    p.z = Math.max(world.bounds.min, Math.min(world.bounds.max, p.z));
    for (const o of world.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const dist = Math.hypot(dx, dz);
      const minDist = o.r + RADIUS;
      if (dist < minDist && dist > 0) {
        p.x = o.x + (dx / dist) * minDist;
        p.z = o.z + (dz / dist) * minDist;
      }
    }
  }
}
