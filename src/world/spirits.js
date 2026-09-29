// Духи — как выглядят и двигаются: поднимаются из тумана у края острова, летят (скелет — идёт пешком)
// к своей цели, копаются, уносят добычу и опускаются обратно в туман. На рассвете тают.
// Рядом со спелыми растениями дух дрожит, а испугавшись — роняет добычу и быстро улетает.
// Что им можно и что пропадает, решают правила (night.js): здесь только движение.
import * as THREE from 'three';
import { SPIRITS, CELL_SIZE, BASKET_CELL } from '../config.js';
import { Sprite } from '../render/sprites.js';
import { getSheets } from './sheets.js';
import { SPIRIT, PLANT_ORDER } from '../art/sprite-art.js';
import { cellToWorld } from '../grid.js';
import { unregisterSprite } from '../render/view-angle.js';

const FPS = { move: 6, act: 8, carry: 6 };
const RISE = 2.5;   // сколько секунд поднимается из тумана
const DEPTH = -3;   // откуда поднимается (глубина в тумане)
const HOVER = { ghost: 0.3, skeleton: 0, wisp: 0.5 }; // на какой высоте держится над землёй

const rand = (a, b) => a + Math.random() * (b - a);

// island — прямоугольник острова; night — правила ночи; hooks — звуки и эффекты
export function createSpirits(scene, camera, island, night, hooks = {}) {
  const center = new THREE.Vector3((island.minX + island.maxX) / 2, 0, (island.minZ + island.maxZ) / 2);
  const edge = Math.max(island.maxX - island.minX, island.maxZ - island.minZ) / 2 + 1.5; // чуть за краем острова
  const sheets = getSheets();
  const list = [];
  const right = new THREE.Vector3();

  // Точка у края острова в сторону angle. Со стороны дома (дальний край) не приходят — там ни пройти, ни увидеть.
  const edgePoint = (angle) => center.clone().add(new THREE.Vector3(Math.cos(angle) * edge, 0, Math.sin(angle) * edge));
  const spawnAngle = () => {
    let a;
    do a = rand(0, Math.PI * 2); while (Math.sin(a) < -0.4);
    return a;
  };

  // Куда встать у цели: на грядку — прямо над ней; к корзинке — рядом, со стороны огорода
  function targetPoint(target) {
    if (target?.cell) return cellToWorld(target.cell.x, target.cell.z);
    if (target?.basket) {
      const b = cellToWorld(BASKET_CELL.x, BASKET_CELL.z);
      return b.add(center.clone().sub(b).setY(0).setLength(0.45));
    }
    return null;
  }

  function add(spirit) {
    const kind = spirit.kind;
    const sprite = new Sprite(sheets.spirits, { castShadow: kind !== 'wisp' }); // блуждающий огонь сам светится — без тени
    const loot = new Sprite(sheets.held, { castShadow: false });
    loot.mesh.visible = false;
    sprite.object.add(loot.mesh);
    scene.add(sprite.object);

    const angle = spawnAngle();
    const start = edgePoint(angle);
    sprite.object.position.set(start.x, DEPTH, start.z);
    // бродяга (без цели) заглядывает на пару случайных грядок
    const stops = spirit.target
      ? [targetPoint(spirit.target)]
      : [0, 1].map(() => cellToWorld(Math.floor(rand(0, 8)), Math.floor(rand(0, 8))));
    list.push({
      spirit, kind, sprite, loot, angle, stops,
      state: 'rise', t: 0, anim: 'move', animTime: 0, phase: rand(0, 10), flip: false, scale: 1,
    });
    hooks.onAppear?.(spirit);
  }

  // Двигаться к точке на своей высоте; true — дошёл. speed — клеток в секунду
  function moveTo(s, point, dt, speed = SPIRITS.kinds[s.kind].speed) {
    const pos = s.sprite.object.position;
    const to = point.clone().setY(0).sub(pos.clone().setY(0));
    const step = speed * CELL_SIZE * dt;
    const dist = to.length();
    if (dist <= step) {
      pos.x = point.x;
      pos.z = point.z;
      return true;
    }
    to.setLength(step);
    pos.x += to.x;
    pos.z += to.z;
    s.flip = to.dot(right) < 0; // смотрит, куда летит
    return false;
  }

  function showLoot(s, loot) {
    s.loot.mesh.visible = true;
    if (loot.crop) {
      s.loot.sheet = sheets.held;
      s.loot.mesh.material = sheets.held.material;
      s.loot.setFrame(PLANT_ORDER.indexOf(loot.crop), 0);
      s.loot.mesh.scale.setScalar(1);
    } else {
      // монетка — из листа духов
      s.loot.sheet = sheets.spirits;
      s.loot.mesh.material = sheets.spirits.material;
      s.loot.setFrame(0, SPIRIT.rows_.coin);
      s.loot.mesh.scale.setScalar(0.5);
    }
    s.loot.mesh.position.set(0, s.kind === 'skeleton' ? 0.55 : 0.5, 0.02);
  }

  function update(dt, time) {
    right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    for (const s of [...list]) {
      const pos = s.sprite.object.position;
      s.t += dt;
      const hover = HOVER[s.kind] + (s.kind === 'ghost' ? Math.sin(time * 2 + s.phase) * 0.08 : 0);

      // страх: рядом со спелыми растениями дух замедляется и дрожит; испугался — убегает
      let slow = 0;
      if (s.state === 'go' || s.state === 'grab' || s.state === 'leave') {
        const fear = night.scare(s.spirit, pos, dt);
        slow = fear.slow;
        if (fear.scared) {
          const returned = night.flee(s.spirit);
          s.loot.mesh.visible = false;
          s.state = 'flee';
          s.t = 0;
          s.exit = edgePoint(Math.atan2(pos.z - center.z, pos.x - center.x));
          hooks.onScared?.(s.spirit, pos.clone().setY(0), fear.from, returned);
        }
      }
      const speed = SPIRITS.kinds[s.kind].speed * (1 - slow);
      const courage = SPIRITS.kinds[s.kind].courage;
      const shake = s.state === 'flee' || s.spirit.fear > courage * 0.5 ? Math.sin(time * 40 + s.phase) * 0.03 : 0;

      if (s.state === 'rise') {
        // поднимается из тумана, потом летит к цели
        const k = Math.min(1, s.t / RISE);
        pos.y = DEPTH + (hover - DEPTH) * (1 - (1 - k) ** 3);
        if (k >= 1) { s.state = 'go'; s.t = 0; }
      } else if (s.state === 'go') {
        pos.y = hover;
        if (moveTo(s, s.stops[0], dt, speed)) { s.state = 'grab'; s.t = 0; }
      } else if (s.state === 'grab') {
        pos.y = hover;
        const wait = s.spirit.target ? SPIRITS.grabSeconds : 1.2; // бродяга просто заглядывает
        if (s.t >= wait) {
          s.stops.shift();
          if (s.spirit.target) {
            const loot = night.grab(s.spirit);
            if (loot) {
              showLoot(s, loot);
              hooks.onGrab?.(s.spirit, loot, pos.clone().setY(0));
            }
            s.stops = [];
          }
          s.t = 0;
          if (!s.stops.length) {
            s.state = 'leave';
            s.exit = edgePoint(Math.atan2(pos.z - center.z, pos.x - center.x) + rand(-0.4, 0.4));
            hooks.onLeave?.(s.spirit);
          } else {
            s.state = 'go';
          }
        }
      } else if (s.state === 'leave') {
        pos.y = hover;
        if (moveTo(s, s.exit, dt, speed)) { s.state = 'sink'; s.t = 0; }
      } else if (s.state === 'flee') {
        // испугался: быстро прочь, чуть подпрыгнув
        pos.y = hover + Math.min(0.4, s.t * 1.5);
        if (moveTo(s, s.exit, dt, SPIRITS.fleeSpeed)) { s.state = 'sink'; s.t = 0; }
      } else if (s.state === 'sink' || s.state === 'fade') {
        // уходит вниз в туман (на рассвете — ещё и тает)
        pos.y -= dt * (s.state === 'fade' ? 1.5 : 2);
        if (s.state === 'fade') s.scale = Math.max(0, s.scale - dt / 1.5);
        if (pos.y < DEPTH || s.scale <= 0) remove(s);
      }

      // блуждающий огонь летит зигзагом
      if (s.kind === 'wisp' && (s.state === 'go' || s.state === 'leave')) {
        pos.x += Math.cos(time * 3 + s.phase) * right.x * dt * 0.8;
        pos.z += Math.cos(time * 3 + s.phase) * right.z * dt * 0.8;
      }

      // кадр анимации
      const anim = s.state === 'grab' ? 'act' : s.loot.mesh.visible ? 'carry' : 'move';
      if (anim !== s.anim) { s.anim = anim; s.animTime = 0; }
      s.animTime += dt;
      const [first, count] = SPIRIT.anims[anim];
      s.sprite.setFrame(first + (Math.floor(s.animTime * FPS[anim] + s.phase) % count), SPIRIT.rows_[s.kind]);
      s.sprite.mesh.scale.set(s.flip ? -s.scale : s.scale, s.scale, 1);
      s.sprite.mesh.position.x = shake; // дрожит от страха
    }
  }

  function remove(s) {
    scene.remove(s.sprite.object);
    unregisterSprite(s.sprite.object);
    unregisterSprite(s.loot.object);
    list.splice(list.indexOf(s), 1);
    night.gone(s.spirit);
  }

  return {
    add,
    update,
    get count() { return list.length; },
    // Рассвет: все духи тают и опускаются в туман (с добычей — она уже не вернётся)
    dawn() {
      for (const s of list) {
        if (s.state !== 'sink' && s.state !== 'flee') { s.state = 'fade'; s.t = 0; }
      }
    },
  };
}
