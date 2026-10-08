// Как выглядят атаки растений ночью: морковь хлещет ботвой, редис стреляет искрой, тыква толкает (земля летит кругом),
// подсолнух светит конусом света, гриб пускает кольцо спор. Попадание — пиксельная звёздочка на духе.
// Кто по кому бьёт, решают правила (night.js): здесь только картинка.
import * as THREE from 'three';
import { COLORS, CELL_SIZE } from '../config.js';
import { ParticlePool } from '../render/particles.js';
import { glowMaterial } from '../render/glow.js';
import { Sprite, LAYER } from '../render/sprites.js';
import { unregisterSprite } from '../render/view-angle.js';
import { getSheets } from './sheets.js';
import { FX } from '../art/sprite-art.js';
import { cellToWorld } from '../grid.js';

const rand = (a, b) => a + Math.random() * (b - a);
const plain = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });

// Сколько секунд длится каждый эффект и насколько ярок
const WHIP_SECONDS = 0.18;    // ботва долетает до духа
const BEAM_SECONDS = 0.7;     // конус света подсолнуха
const BEAM_BRIGHTNESS = 0.55;
const RING_SECONDS = 0.6;     // кольцо спор
const STAR_SECONDS = 0.28;    // звёздочка попадания

// Мягкий свет: ярко у начала (v = 0), гаснет к концу; края по бокам размыты
function beamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const along = ctx.createLinearGradient(0, 64, 0, 0);
  along.addColorStop(0, 'rgba(255,255,255,1)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, 32, 64);
  ctx.globalCompositeOperation = 'destination-in';
  const across = ctx.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.3, 'rgba(0,0,0,1)');
  across.addColorStop(0.7, 'rgba(0,0,0,1)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, 32, 64);
  return new THREE.CanvasTexture(canvas);
}

// Кольцо: светлый ободок, прозрачная середина
function ringTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.85, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Лежащая на земле трапеция: узкая у подсолнуха (near), широкая вдали (far), длиной length вперёд (+z; поворачивается к духу)
function coneGeometry(near, far, length) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -near / 2, 0, 0, near / 2, 0, 0, -far / 2, 0, length, far / 2, 0, length,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

// positionOf(spirit) — где дух сейчас (из world/spirits.js)
export function createAttacks(scene, positionOf) {
  const fxSheet = getSheets().fx;
  const leaves = new ParticlePool(scene, { count: 120, width: 0.08, material: glowMaterial('#8fd65a', 0.6) });
  const leafBits = new ParticlePool(scene, { count: 60, width: 0.05, material: plain(COLORS.leaves) });
  const embers = new ParticlePool(scene, { count: 160, width: 0.05, material: glowMaterial('#ff8a4a', 1.4) });
  const dirt = new ParticlePool(scene, { count: 60, width: 0.06, material: plain(COLORS.mound) });
  const motes = new ParticlePool(scene, { count: 80, width: 0.04, material: glowMaterial('#ffe8a0', 1.2) });
  const spores = new ParticlePool(scene, { count: 120, width: 0.05, material: glowMaterial(COLORS.mushroomCap, 1) });
  const beamMap = beamTexture();
  const ringMap = ringTexture();
  const sprites = []; // искры в полёте и звёздочки: { sprite, t, life, update }
  const whips = [];   // ботва в полёте
  const glows = [];   // конусы света и кольца спор на земле: { mesh, t, life, update }

  const plantPoint = (c, h = 0.35) => cellToWorld(c.x, c.z).setY(h);
  const spiritPoint = (spirit) => {
    const p = positionOf(spirit);
    return p ? p.clone().setY(p.y + 0.4) : null;
  };

  function fxSprite(row, at, scale = 1) {
    const sprite = new Sprite(fxSheet, { castShadow: false, layer: LAYER.fx });
    sprite.mesh.geometry.translate(0, -(FX.frameH / 30) / 2, 0); // центр картинки — в точке (а не низ)
    sprite.object.position.copy(at);
    sprite.mesh.scale.setScalar(scale);
    sprite.setFrame(0, row);
    scene.add(sprite.object);
    return sprite;
  }

  function removeSprite(entry) {
    scene.remove(entry.sprite.object);
    unregisterSprite(entry.sprite.object);
    entry.sprite.mesh.geometry.dispose();
    sprites.splice(sprites.indexOf(entry), 1);
  }

  // turn — поворот вокруг вертикали (для луча — в сторону духа)
  function groundGlow(geometry, map, color, at, life, update, turn = 0) {
    const material = new THREE.MeshBasicMaterial({
      map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(at);
    mesh.rotation.y = turn;
    scene.add(mesh);
    glows.push({ mesh, t: 0, life, update });
  }

  // Морковь: ботва дугой хлещет от грядки до духа, по пути осыпаются листочки
  function whip(c, spirit) {
    whips.push({ from: plantPoint(c, 0.45), spirit, t: 0, done: 0 });
  }

  // Редис: искра летит дугой к духу, оставляя огненный хвостик
  function spark(c, spirit, delay) {
    const from = plantPoint(c, 0.6);
    const sprite = fxSprite(FX.rows_.spark, from, 0.9);
    sprites.push({
      sprite, t: 0, life: delay,
      update(e, k) {
        const to = spiritPoint(spirit);
        if (!to) return false;
        const p = from.clone().lerp(to, k);
        p.y += Math.sin(k * Math.PI) * 0.3;
        e.sprite.object.position.copy(p);
        e.sprite.setFrame(Math.floor(e.t * 14) % FX.cols, FX.rows_.spark);
        embers.spawn({ pos: p, vel: new THREE.Vector3(rand(-0.15, 0.15), rand(0, 0.3), rand(-0.15, 0.15)), life: 0.3, size: rand(0.7, 1.2), gravity: 0 });
        return true;
      },
    });
  }

  // Тыква: толчок — земля разлетается кругом
  function thump(c) {
    const at = plantPoint(c, 0.08);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      dirt.spawn({ pos: at, vel: new THREE.Vector3(Math.cos(a) * rand(1.2, 1.8), rand(0.8, 1.6), Math.sin(a) * rand(1.2, 1.8)), life: 0.6, gravity: 0.6, spin: rand(-6, 6) });
    }
  }

  // Подсолнух: конус света от головы вдоль земли в сторону духа (toward — где дух, в клетках), в нём кружатся пылинки
  function beam(c, reach, toward = { x: c.x, z: c.z + 1 }) {
    const length = (reach + 0.5) * CELL_SIZE;
    const at = cellToWorld(c.x, c.z).setY(0.06);
    const dir = new THREE.Vector3(toward.x - c.x, 0, toward.z - c.z).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x); // поперёк луча
    groundGlow(coneGeometry(0.5 * CELL_SIZE, 2 * CELL_SIZE, length), beamMap, '#ffe08a', at, BEAM_SECONDS, (g, k) => {
      g.mesh.material.opacity = BEAM_BRIGHTNESS * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    }, Math.atan2(dir.x, dir.z));
    for (let i = 0; i < 16; i++) {
      const along = rand(0.3, length);
      const half = 0.25 + (0.75 * along) / length;
      motes.spawn({
        pos: at.clone().addScaledVector(dir, along).addScaledVector(side, rand(-half, half)).setY(rand(0.05, 0.4)),
        vel: dir.clone().multiplyScalar(rand(0.1, 0.4)).setY(rand(0.2, 0.5)), life: rand(0.6, 1), gravity: 0,
      });
    }
    // вспышка у головы
    const head = plantPoint(c, 1.05);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      motes.spawn({ pos: head, vel: new THREE.Vector3(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0), life: 0.35, size: 1.4, gravity: 0 });
    }
  }

  // Гриб: по земле расходится светлое кольцо спор, над шляпкой — облачко
  function sporeWave(c, reach) {
    const radius = (reach + 0.5) * CELL_SIZE;
    const at = cellToWorld(c.x, c.z).setY(0.07);
    const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    groundGlow(geometry, ringMap, COLORS.mushroomCap, at, RING_SECONDS, (g, k) => {
      g.mesh.scale.setScalar(0.2 + radius * (1 - (1 - k) ** 2));
      g.mesh.material.opacity = 0.8 * (1 - k);
    });
    const cap = plantPoint(c, 0.45);
    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(0.3, (radius / RING_SECONDS) * 0.9);
      spores.spawn({ pos: cap, vel: new THREE.Vector3(Math.cos(a) * speed, rand(0.2, 0.7), Math.sin(a) * speed), life: rand(0.6, 1.1), gravity: 0 });
    }
  }

  return {
    // Растение ударило: { type, reach, from, targets, delay } из night.js
    show({ type, reach, from, targets, delay, toward }) {
      if (type === 'whip') for (const s of targets) whip(from, s);
      else if (type === 'spark') spark(from, targets[0], delay);
      else if (type === 'wall') thump(from);
      else if (type === 'beam') beam(from, reach, toward);
      else if (type === 'spores') sporeWave(from, reach);
    },

    // Удар попал в духа: пиксельная звёздочка раскрывается и гаснет
    hit(spirit) {
      const at = spiritPoint(spirit);
      if (!at) return;
      at.x += rand(-0.1, 0.1);
      at.y += rand(-0.05, 0.1);
      const sprite = fxSprite(FX.rows_.star, at, 1.1);
      sprites.push({
        sprite, t: 0, life: STAR_SECONDS,
        update(e, k) {
          e.sprite.setFrame(Math.min(FX.cols - 1, Math.floor(k * FX.cols)), FX.rows_.star);
          return true;
        },
      });
    },

    update(dt) {
      // ботва: дуга дорастает до духа за WHIP_SECONDS
      for (const w of [...whips]) {
        w.t += dt;
        const to = spiritPoint(w.spirit);
        const k = Math.min(1, w.t / WHIP_SECONDS);
        if (to) {
          const steps = 12;
          for (let i = w.done; i < Math.round(k * steps); i++) {
            const q = (i + 1) / steps;
            const p = w.from.clone().lerp(to, q);
            p.y += Math.sin(q * Math.PI) * 0.4;
            leaves.spawn({ pos: p, vel: new THREE.Vector3(rand(-0.1, 0.1), rand(0, 0.2), rand(-0.1, 0.1)), life: 0.22 + q * 0.12, size: rand(0.8, 1.3), gravity: 0 });
            if (i % 3 === 0) leafBits.spawn({ pos: p, vel: new THREE.Vector3(rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3)), life: 0.9, gravity: 0.35, spin: rand(-8, 8) });
          }
          w.done = Math.round(k * steps);
        }
        if (k >= 1 || !to) whips.splice(whips.indexOf(w), 1);
      }
      // искры и звёздочки
      for (const e of [...sprites]) {
        e.t += dt;
        const k = Math.min(1, e.t / e.life);
        if (!e.update(e, k) || k >= 1) removeSprite(e);
      }
      // конусы света и кольца спор
      for (const g of [...glows]) {
        g.t += dt;
        const k = Math.min(1, g.t / g.life);
        g.update(g, k);
        if (k >= 1) {
          scene.remove(g.mesh);
          g.mesh.geometry.dispose();
          g.mesh.material.dispose();
          glows.splice(glows.indexOf(g), 1);
        }
      }
      leaves.update(dt, (p, t) => 1 - t);
      leafBits.update(dt, (p, t) => 1 - t * 0.5);
      embers.update(dt, (p, t) => 1 - t);
      dirt.update(dt, (p, t) => 1 - t * 0.5);
      motes.update(dt, (p, t) => Math.sin(Math.PI * t));
      spores.update(dt, (p, t) => Math.sin(Math.PI * Math.min(1, t * 1.2)));
    },
  };
}
