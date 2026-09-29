// Духи — как выглядят и двигаются: у дальнего края огорода в тумане проступает свечение, из него поднимается дух
// и медленно идёт по своему ряду к дому (скелет — пешком, остальные летят). У первого спелого растения
// останавливается и тянет его; утащил — уходит с ним обратно в туман. Прошёл ряд — сворачивает к корзинке.
// От ударов растений дух вздрагивает и бледнеет, а испугавшись — роняет добычу и быстро улетает. На рассвете тают.
// Что им можно и что пропадает, решают правила (night.js): здесь только движение.
import * as THREE from 'three';
import { SPIRITS, CELL_SIZE, BASKET_CELL, GARDEN_SIZE } from '../config.js';
import { Sprite } from '../render/sprites.js';
import { getSheets } from './sheets.js';
import { SPIRIT, PLANT_ORDER } from '../art/sprite-art.js';
import { cellToWorld } from '../grid.js';
import { unregisterSprite } from '../render/view-angle.js';

const FPS = { move: 6, act: 8, carry: 6 };
const RISE = 2.5;   // сколько секунд поднимается из тумана
const DEPTH = -3;   // откуда поднимается (глубина в тумане)
const HOVER = { ghost: 0.3, skeleton: 0, wisp: 0.5 }; // на какой высоте держится над землёй
const WARN_COLOR = '#9fe8ff'; // свечение в тумане перед появлением духа

const rand = (a, b) => a + Math.random() * (b - a);
const OFFSET = (GARDEN_SIZE - 1) / 2;
const cellZ = (pos) => pos.z / CELL_SIZE + OFFSET; // в какой клетке ряда дух сейчас (дробное число)

// Мягкое круглое пятно света — для свечения в тумане
function glowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// island — прямоугольник острова; night — правила ночи; hooks — звуки и эффекты
export function createSpirits(scene, camera, island, night, hooks = {}) {
  const farZ = island.maxZ + 1.2; // откуда приходят и куда уходят: туман за дальним краем острова
  const sheets = getSheets();
  const list = [];
  const glows = [];
  const right = new THREE.Vector3();
  const glowMap = glowTexture();

  const rowX = (row) => cellToWorld(row, 0).x;
  const fogPoint = (row) => new THREE.Vector3(rowX(row), 0, farZ);
  // конец ряда — дорожка у дома; у корзинки встаём сбоку (со стороны своего ряда) или спереди, если ряд прямо на неё
  const basket = cellToWorld(BASKET_CELL.x, BASKET_CELL.z);
  const rowEnd = (row) => new THREE.Vector3(rowX(row), 0, basket.z);
  const basketPoint = (row) => (row === BASKET_CELL.x
    ? basket.clone().setZ(basket.z + 0.55 * CELL_SIZE)
    : basket.clone().setX(basket.x + Math.sign(row - BASKET_CELL.x) * 0.55 * CELL_SIZE));

  // Скоро придёт дух: в тумане у ряда проступает свечение (гаснет, когда дух поднимется)
  function warn(row) {
    const material = new THREE.SpriteMaterial({
      map: glowMap, color: WARN_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const glow = new THREE.Sprite(material);
    glow.position.set(rowX(row), -0.6, farZ);
    glow.scale.setScalar(2.6);
    scene.add(glow);
    glows.push({ glow, t: 0, life: SPIRITS.warnSeconds + RISE, phase: rand(0, 10) });
  }

  function updateGlows(dt, time) {
    for (const g of [...glows]) {
      g.t += dt;
      const k = g.t < SPIRITS.warnSeconds
        ? g.t / SPIRITS.warnSeconds                                  // разгорается
        : 1 - (g.t - SPIRITS.warnSeconds) / RISE;                    // дух поднялся — гаснет
      g.glow.material.opacity = Math.max(0, k) * (0.75 + 0.25 * Math.sin(time * 5 + g.phase));
      if (g.t >= g.life) {
        scene.remove(g.glow);
        g.glow.material.dispose();
        glows.splice(glows.indexOf(g), 1);
      }
    }
  }

  function add(spirit) {
    const kind = spirit.kind;
    const sprite = new Sprite(sheets.spirits, { castShadow: kind !== 'wisp' }); // блуждающий огонь сам светится — без тени
    sprite.mesh.material = sheets.spirits.material.clone(); // свой материал: бледнеет от ударов независимо от других
    sprite.mesh.material.transparent = true;
    const loot = new Sprite(sheets.held, { castShadow: false });
    loot.mesh.visible = false;
    sprite.object.add(loot.mesh);
    scene.add(sprite.object);

    const start = fogPoint(spirit.row);
    sprite.object.position.set(start.x, DEPTH, start.z);
    list.push({
      spirit, kind, sprite, loot,
      state: 'rise', leg: 'row', // leg: 'row' — идёт по ряду, 'path' — по дорожке к корзинке
      grabTarget: null, exit: [], t: 0, courage: spirit.courage, flinch: 0, pale: 1, push: 0,
      anim: 'move', animTime: 0, phase: rand(0, 10), flip: false, scale: 1,
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
    if (Math.abs(to.dot(right)) > 1e-4) s.flip = to.dot(right) < 0; // смотрит, куда идёт
    return false;
  }

  // Идти по списку точек (s.exit); true — дошёл до последней
  function followExit(s, dt, speed) {
    while (s.exit.length && moveTo(s, s.exit[0], dt, speed)) s.exit.shift();
    return !s.exit.length;
  }

  // Уйти обратно в туман по своему ряду (с дорожки — сначала вернуться к началу ряда)
  function leave(s) {
    s.state = 'leave';
    s.t = 0;
    s.exit = s.leg === 'path' ? [rowEnd(s.spirit.row), fogPoint(s.spirit.row)] : [fogPoint(s.spirit.row)];
    hooks.onLeave?.(s.spirit);
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

  // Шаг по ряду к дому: до первого спелого растения, а если его нет — к корзинке
  function walk(s, dt, speed) {
    const pos = s.sprite.object.position;
    const row = s.spirit.row;
    if (s.leg === 'row') {
      const stop = night.stopAhead(s.spirit, cellZ(pos));
      if (stop) {
        if (moveTo(s, cellToWorld(stop.x, stop.z), dt, speed)) grab(s, { cell: stop });
        return;
      }
      // ряд пройден насквозь: к дорожке у дома (если ряд упирается прямо в корзинку — сразу к ней)
      if (row === BASKET_CELL.x || moveTo(s, rowEnd(row), dt, speed)) s.leg = 'path';
      return;
    }
    if (moveTo(s, basketPoint(row), dt, speed)) grab(s, { basket: true });
  }

  function grab(s, target) {
    s.state = 'grab';
    s.t = 0;
    s.grabTarget = target;
  }

  function update(dt, time) {
    right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    updateGlows(dt, time);
    for (const s of [...list]) {
      const pos = s.sprite.object.position;
      s.t += dt;
      const hover = HOVER[s.kind] + (s.kind === 'ghost' ? Math.sin(time * 2 + s.phase) * 0.08 : 0);

      // где дух для правил: растения бьют только тех, кто идёт по огороду, тянет добычу или уходит
      const reachable = s.state === 'go' || s.state === 'grab' || s.state === 'leave';
      s.spirit.at = reachable && !s.spirit.fled ? { x: pos.x / CELL_SIZE + OFFSET, z: cellZ(pos) } : null;
      // удар попал: вздрагивает
      if (s.spirit.courage < s.courage) { s.courage = s.spirit.courage; s.flinch = 1; }
      s.flinch = Math.max(0, s.flinch - dt * 4);
      // смелость кончилась: испугался — роняет добычу, убегает
      if (reachable && s.spirit.courage <= 0 && !s.spirit.fled) {
        const returned = night.flee(s.spirit);
        s.loot.mesh.visible = false;
        s.state = 'flee';
        s.t = 0;
        s.exit = [new THREE.Vector3(pos.x, 0, farZ)]; // прочь по прямой в туман за дальним краем
        hooks.onScared?.(s.spirit, pos.clone().setY(0), s.spirit.hitBy, returned);
      }
      const speed = SPIRITS.kinds[s.kind].speed;
      // чем меньше смелости, тем бледнее и сильнее дрожит
      const bold = Math.max(0, s.spirit.courage) / SPIRITS.kinds[s.kind].courage;
      const tremble = s.state === 'flee' ? 1 : 1 - bold;
      const shake = Math.sin(time * 40 + s.phase) * (0.035 * tremble + 0.06 * s.flinch);
      const pale = s.state === 'flee' || s.state === 'sink' ? 0.5 : 0.45 + 0.55 * bold;
      s.pale += (pale - s.pale) * Math.min(1, dt * 6);

      // толчок тыквы: отлетает назад, к туману (если тянул добычу — выпускает её и снова идёт к ней)
      if (s.push > 0) {
        const step = Math.min(s.push, dt * 4);
        pos.z += step * CELL_SIZE;
        s.push -= step;
      }

      if (s.state === 'rise') {
        // поднимается из тумана, потом идёт по ряду
        const k = Math.min(1, s.t / RISE);
        pos.y = DEPTH + (hover - DEPTH) * (1 - (1 - k) ** 3);
        if (k >= 1) { s.state = 'go'; s.t = 0; }
      } else if (s.state === 'go') {
        pos.y = hover + s.flinch * 0.08;
        walk(s, dt, speed * (1 - 0.8 * s.flinch)); // от удара на миг сбивается с шага
      } else if (s.state === 'grab') {
        pos.y = hover;
        const target = s.grabTarget;
        if (target.cell && !night.isRipe(target.cell)) {
          s.state = 'go'; // растение успели собрать — идёт дальше
        } else if (s.t >= night.holdSeconds(target)) {
          const loot = night.grab(s.spirit, target);
          if (loot) {
            showLoot(s, loot);
            hooks.onGrab?.(s.spirit, loot, pos.clone().setY(0));
            leave(s);
          } else if (target.cell) {
            s.state = 'go';
          } else {
            leave(s); // корзинка пуста — уходит ни с чем
          }
        }
      } else if (s.state === 'leave') {
        pos.y = hover;
        if (followExit(s, dt, speed * SPIRITS.leaveSpeed)) { s.state = 'sink'; s.t = 0; }
      } else if (s.state === 'flee') {
        // испугался: быстро прочь, чуть подпрыгнув
        pos.y = hover + Math.min(0.4, s.t * 1.5);
        if (followExit(s, dt, SPIRITS.fleeSpeed)) { s.state = 'sink'; s.t = 0; }
      } else if (s.state === 'sink' || s.state === 'fade') {
        // уходит вниз в туман (на рассвете — ещё и тает)
        pos.y -= dt * (s.state === 'fade' ? 1.5 : 2);
        if (s.state === 'fade') s.scale = Math.max(0, s.scale - dt / 1.5);
        if (pos.y < DEPTH || s.scale <= 0) remove(s);
      }

      // блуждающий огонь покачивается из стороны в сторону, не сходя со своего ряда
      const sway = s.kind === 'wisp' && (s.state === 'go' || s.state === 'leave') ? Math.sin(time * 3 + s.phase) * 0.15 : 0;

      // кадр анимации
      const anim = s.state === 'grab' ? 'act' : s.loot.mesh.visible ? 'carry' : 'move';
      if (anim !== s.anim) { s.anim = anim; s.animTime = 0; }
      s.animTime += dt;
      const [first, count] = SPIRIT.anims[anim];
      s.sprite.setFrame(first + (Math.floor(s.animTime * FPS[anim] + s.phase) % count), SPIRIT.rows_[s.kind]);
      s.sprite.mesh.scale.set(s.flip ? -s.scale : s.scale, s.scale, 1);
      s.sprite.mesh.position.x = shake + sway; // дрожит от страха
      const m = s.sprite.mesh.material;
      m.opacity = s.pale;
      m.color.setScalar(1 + 1.5 * s.flinch); // от удара на миг белеет
      m.alphaTest = 0.5 * s.pale; // иначе полупрозрачный дух целиком отсекается
    }
  }

  function remove(s) {
    s.spirit.at = null;
    s.sprite.mesh.material.dispose();
    scene.remove(s.sprite.object);
    unregisterSprite(s.sprite.object);
    unregisterSprite(s.loot.object);
    list.splice(list.indexOf(s), 1);
    night.gone(s.spirit);
  }

  return {
    warn,
    add,
    // Толчок: отлетает на cells клеток назад, к туману
    knock(spirit, cells) {
      const s = list.find((x) => x.spirit === spirit);
      if (!s || !['go', 'grab', 'leave'].includes(s.state)) return;
      s.push = cells;
      if (s.state === 'grab') { s.state = 'go'; s.t = 0; }
    },
        // Где дух сейчас (для эффектов атак); null — его уже нет
    positionOf(spirit) {
      const s = list.find((x) => x.spirit === spirit);
      return s ? s.sprite.object.position : null;
    },
    update,
    get count() { return list.length; },
    // Рассвет: все духи тают и опускаются в туман (с добычей — она уже не вернётся)
    dawn() {
      for (const s of list) {
        if (s.state !== 'sink' && s.state !== 'flee') { s.state = 'fade'; s.t = 0; }
      }
      for (const g of glows) g.t = Math.max(g.t, SPIRITS.warnSeconds); // свечение гаснет
    },
  };
}
