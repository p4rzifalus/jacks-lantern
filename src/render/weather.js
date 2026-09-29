// Погода: время от времени идёт дождь (только для красоты — на растения не влияет).
// Капли — косые штрихи по ветру, на земле брызги; всё мокнет (темнее и блестит),
// на дорожке проступают лужи с отражением неба и бликами фонарей; небо и солнце приглушаются.
import * as THREE from 'three';
import { WEATHER } from '../config.js';
import { ParticlePool } from './particles.js';
import { allMaterials } from '../art/assets.js';
import { cellToWorld } from '../grid.js';

const rand = (a, b) => a + Math.random() * (b - a);

// Форма лужи: неровное пятно с мягким краем (рисуется один раз)
function puddleTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const bumps = Array.from({ length: 5 }, () => [Math.random() * Math.PI * 2, rand(0.05, 0.15), Math.floor(rand(2, 5))]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const a = Math.atan2(dy, dx);
      const edge = 0.7 + bumps.reduce((s, [ph, amp, f]) => s + amp * Math.sin(a * f + ph), 0);
      const d = Math.hypot(dx, dy) / edge;
      const alpha = Math.max(0, Math.min(1, (1 - d) * 6)); // мягкий край
      img.data.set([255, 255, 255, alpha * 255], (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function createWeather(scene, quality, lighting, islandCore) {
  // Капли: вытянутые штрихи
  const rainMat = new THREE.MeshBasicMaterial({ color: WEATHER.rainColor, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  const drops = new ParticlePool(scene, { count: Math.ceil(WEATHER.drops * quality.particles), width: 0.015, height: 0.35, material: rainMat });
  const splashMat = new THREE.MeshBasicMaterial({ color: WEATHER.rainColor, transparent: true, opacity: 0.6, depthWrite: false });
  const splashes = new ParticlePool(scene, { count: 200, width: 0.05, height: 0.03, material: splashMat });

  // Лужи на дорожке и у дома
  // почти зеркало: отражает вечернее небо, фонари дают в ней яркие блики
  const puddleMat = new THREE.MeshStandardMaterial({
    color: '#9aa0b8', roughness: 0.06, metalness: 0.85, envMapIntensity: 1.6, transparent: true, opacity: 0,
    alphaMap: puddleTexture(), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  puddleMat.userData.skipWetness = true;
  for (const [x, z, s] of WEATHER.puddles) {
    const p = cellToWorld(x, z);
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.8), puddleMat);
    puddle.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    puddle.position.set(p.x + rand(-0.2, 0.2), 0.012, p.z + rand(-0.2, 0.2));
    puddle.receiveShadow = true;
    scene.add(puddle);
  }

  let raining = false;
  let wetness = 0;          // 0 — сухо, 1 — всё мокрое
  let intensity = 0;        // сила дождя 0..1 (плавно нарастает и стихает)
  let timer = rand(...WEATHER.clearMinutes) * 60;
  let spawnCarry = 0;

  // Намокание: материалы темнеют и становятся глаже (блестят). Сухие значения запоминаем,
  // когда начинается первый дождь (к этому времени все картинки загружены).
  let appliedWetness = 0;
  function applyWetness() {
    if (wetness < 0.001 && appliedWetness < 0.001) return; // сухо — ничего не трогаем
    appliedWetness = wetness;
    for (const m of allMaterials()) {
      if (m.userData.skipWetness) continue;
      if (!m.userData.dry) m.userData.dry = { color: m.color.clone(), roughness: m.roughness };
      m.color.copy(m.userData.dry.color).multiplyScalar(1 - 0.35 * wetness);
      m.roughness = m.userData.dry.roughness * (1 - 0.55 * wetness);
    }
  }

  return {
    get raining() { return raining; },
    get wetness() { return wetness; },
    get intensity() { return intensity; }, // сила дождя сейчас 0..1 (для звука)
    setRain(on) {
      raining = on;
      timer = rand(...(on ? WEATHER.rainMinutes : WEATHER.clearMinutes)) * 60;
    },

    update(dt, wind) {
      // смена погоды по таймеру
      timer -= dt;
      if (timer <= 0) this.setRain(!raining);
      intensity += ((raining ? 1 : 0) - intensity) * Math.min(1, dt / 4);           // дождь нарастает ~4 с
      wetness += ((raining ? 1 : 0) - wetness) * Math.min(1, dt / (raining ? 8 : 25)); // мокнет быстро, сохнет долго

      // капли падают косо по ветру над всем островом
      const perSecond = drops.particles.length * 2.5 * intensity;
      spawnCarry += perSecond * dt;
      while (spawnCarry >= 1) {
        spawnCarry--;
        drops.spawn({
          pos: new THREE.Vector3(rand(islandCore.minX - 1, islandCore.maxX + 1), rand(4, 6), rand(islandCore.minZ - 1, islandCore.maxZ + 1)),
          vel: new THREE.Vector3(wind.x * 1.5, -9, wind.z * 1.5),
          life: 1.2, gravity: 0.01, // почти не ускоряются, но «касаются земли» — для брызг
          onLand: (p) => {
            if (Math.random() < 0.5) {
              splashes.spawn({ pos: new THREE.Vector3(p.pos.x, 0.03, p.pos.z), vel: new THREE.Vector3(0, 0.4, 0), life: 0.25, gravity: 0.5 });
            }
          },
        });
      }
      drops.update(dt, () => 1);
      splashes.update(dt, (p, t) => 1 + t * 2);

      // лужи проступают (небо и солнце приглушает смена дня и ночи — по силе дождя)
      puddleMat.opacity = wetness * 0.9;
      applyWetness();
    },
  };
}
