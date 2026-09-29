// Как выглядят атаки растений ночью (пока простые, из частиц — красивые кадры и звуки будут позже):
// морковь хлещет ботвой, редис стреляет искрой, тыква толкает, подсолнух светит лучом, гриб пускает волну спор.
// Кто по кому бьёт, решают правила (night.js): здесь только картинка.
import * as THREE from 'three';
import { COLORS, CELL_SIZE } from '../config.js';
import { ParticlePool } from '../render/particles.js';
import { glowMaterial } from '../render/glow.js';
import { cellToWorld } from '../grid.js';

const rand = (a, b) => a + Math.random() * (b - a);
const BEAM_SECONDS = 0.6;    // сколько светит луч подсолнуха
const BEAM_BRIGHTNESS = 0.45; // и насколько ярко

// Луч: светлое пятно на земле, ярче у подсолнуха и гаснет к дальнему концу
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
  // мягкие края по бокам
  ctx.globalCompositeOperation = 'destination-in';
  const across = ctx.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.25, 'rgba(0,0,0,1)');
  across.addColorStop(0.75, 'rgba(0,0,0,1)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, 32, 64);
  return new THREE.CanvasTexture(canvas);
}

// positionOf(spirit) — где дух сейчас (из world/spirits.js)
export function createAttacks(scene, positionOf) {
  const leaves = new ParticlePool(scene, { count: 80, width: 0.06, material: glowMaterial('#9be36a', 0.6) });
  const sparks = new ParticlePool(scene, { count: 160, width: 0.1, material: glowMaterial('#ff9a3c', 1.6) });
  const thumps = new ParticlePool(scene, { count: 40, width: 0.07, material: glowMaterial('#ffb04a', 0.5) });
  const spores = new ParticlePool(scene, { count: 120, width: 0.06, material: glowMaterial(COLORS.mushroomCap, 1) });
  const hits = new ParticlePool(scene, { count: 80, width: 0.05, material: glowMaterial('#e8f6ff', 1.2) });
  const beamMap = beamTexture();
  const shots = [];  // искры редиса в полёте
  const beams = [];  // лучи подсолнуха

  const plantPoint = (c) => cellToWorld(c.x, c.z).setY(0.35);
  const spiritPoint = (spirit) => {
    const p = positionOf(spirit);
    return p ? p.clone().setY(p.y + 0.4) : null;
  };

  function whip(from, spirit) {
    const to = spiritPoint(spirit);
    if (!to) return;
    for (let i = 0; i < 10; i++) {
      const k = i / 9;
      const p = from.clone().lerp(to, k).setY(from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 0.35);
      leaves.spawn({ pos: p, vel: new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2)), life: 0.25 + k * 0.15, gravity: 0 });
    }
  }

  function thump(from) {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      thumps.spawn({ pos: from.clone().setY(0.15), vel: new THREE.Vector3(Math.cos(a) * 1.2, rand(0.3, 0.8), Math.sin(a) * 1.2), life: 0.35, gravity: 0.5 });
    }
  }

  function beam(c, reach) {
    const width = 3 * CELL_SIZE;
    const length = (reach + 1) * CELL_SIZE;
    const material = new THREE.MeshBasicMaterial({
      map: beamMap, color: '#ffe08a', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
    mesh.rotation.x = -Math.PI / 2; // лежит на земле, светлый край — у подсолнуха, тёмный — к туману
    const at = cellToWorld(c.x, c.z);
    mesh.position.set(at.x, 0.06, at.z - 0.5 * CELL_SIZE + length / 2);
    scene.add(mesh);
    beams.push({ mesh, t: 0 });
  }

  function sporeWave(from, reach) {
    const n = 28;
    const speed = ((reach + 0.5) * CELL_SIZE) / 0.6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spores.spawn({ pos: from.clone().setY(0.25), vel: new THREE.Vector3(Math.cos(a) * speed, rand(0.1, 0.4), Math.sin(a) * speed), life: 0.6, gravity: 0 });
    }
  }

  return {
    // Растение ударило: { type, reach, from, targets, delay } из night.js
    show({ type, reach, from, targets, delay }) {
      const start = plantPoint(from);
      if (type === 'whip') for (const s of targets) whip(start, s);
      else if (type === 'spark') shots.push({ spirit: targets[0], from: start, t: 0, delay });
      else if (type === 'wall') thump(start);
      else if (type === 'beam') beam(from, reach);
      else if (type === 'spores') sporeWave(start, reach);
    },

    // Удар попал в духа: вспышка светлых искорок
    hit(spirit) {
      const at = spiritPoint(spirit);
      if (!at) return;
      for (let i = 0; i < 10; i++) {
        const a = rand(0, Math.PI * 2);
        hits.spawn({ pos: at, vel: new THREE.Vector3(Math.cos(a) * rand(0.6, 1.2), rand(0.2, 1.2), Math.sin(a) * rand(0.6, 1.2)), life: 0.4, gravity: 0.3 });
      }
    },

    update(dt) {
      // искры редиса летят дугой к духу, оставляя след
      for (const s of [...shots]) {
        s.t += dt;
        const to = spiritPoint(s.spirit);
        const k = Math.min(1, s.t / s.delay);
        if (!to || k >= 1) {
          shots.splice(shots.indexOf(s), 1);
          continue;
        }
        const p = s.from.clone().lerp(to, k);
        p.y += Math.sin(k * Math.PI) * 0.25;
        sparks.spawn({ pos: p, vel: new THREE.Vector3(rand(-0.1, 0.1), rand(0, 0.2), rand(-0.1, 0.1)), life: 0.3, size: 1.5, gravity: 0 });
      }
      // лучи вспыхивают и гаснут
      for (const b of [...beams]) {
        b.t += dt;
        const k = b.t / BEAM_SECONDS;
        b.mesh.material.opacity = BEAM_BRIGHTNESS * (k < 0.2 ? k / 0.2 : Math.max(0, 1 - (k - 0.2) / 0.8));
        if (k >= 1) {
          scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.mesh.material.dispose();
          beams.splice(beams.indexOf(b), 1);
        }
      }
      leaves.update(dt, (p, t) => 1 - t);
      sparks.update(dt, (p, t) => 1 - t);
      thumps.update(dt, (p, t) => 1 - t);
      spores.update(dt, (p, t) => Math.sin(Math.PI * Math.min(1, t * 1.2)));
      hits.update(dt, (p, t) => 1 - t);
    },
  };
}
