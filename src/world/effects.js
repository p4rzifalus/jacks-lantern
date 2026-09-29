// Эффекты из частиц: полив, посадка, сбор урожая, монетки у корзинки,
// пылинки в свете фонарей и светящиеся споры над спелыми грибами.
import * as THREE from 'three';
import { COLORS, EFFECTS } from '../config.js';
import { ParticlePool } from '../render/particles.js';
import { glowMaterial } from '../render/glow.js';

const plain = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide });
const rand = (a, b) => a + Math.random() * (b - a);

export function createEffects(scene, quality, lanternLights) {
  const k = quality.particles; // на слабом качестве частиц меньше
  const water = new ParticlePool(scene, { count: 160, width: 0.05, height: 0.07, material: glowMaterial(COLORS.water, 0.35) });
  const splash = new ParticlePool(scene, { count: 120, width: 0.04, material: glowMaterial(COLORS.water, 0.3) });
  const dirt = new ParticlePool(scene, { count: 40, width: 0.06, material: plain(COLORS.mound) });
  const sparks = new ParticlePool(scene, { count: 60, width: 0.05, material: glowMaterial('#ffd870', 1.2) });
  const coins = new ParticlePool(scene, { count: 30, width: 0.1, material: glowMaterial('#f2c24a', 0.6) });
  const dust = new ParticlePool(scene, { count: Math.ceil(40 * k), width: 0.025, material: glowMaterial('#ffe6b0', 0.5) });
  const spores = new ParticlePool(scene, { count: Math.ceil(50 * k), width: 0.035, material: glowMaterial(COLORS.mushroomCap, 1) });

  const splashAt = (pos, n = 4) => {
    for (let i = 0; i < n; i++) {
      splash.spawn({
        pos: new THREE.Vector3(pos.x, 0.02, pos.z),
        vel: new THREE.Vector3(rand(-0.5, 0.5), rand(0.6, 1.2), rand(-0.5, 0.5)),
        life: 0.4, size: rand(0.7, 1.2),
      });
    }
  };

  let sporeTimer = 0;
  let dustTimer = 0;

  return {
    splashAt,

    // Полив: струя капель из лейки (перед героем) дугой на грядку, брызги при падении
    water(from, to) {
      for (let i = 0; i < 28; i++) {
        const delay = i * 0.012;
        const start = from.clone().add(new THREE.Vector3(rand(-0.03, 0.03), rand(0.4, 0.5), rand(-0.03, 0.03)));
        const target = to.clone().add(new THREE.Vector3(rand(-0.25, 0.25), 0, rand(-0.25, 0.25)));
        const flight = 0.45 + delay;
        // скорость, чтобы за flight секунд долететь до цели под действием тяжести
        const vel = target.clone().sub(start).divideScalar(flight);
        vel.y = (target.y - start.y) / flight + 0.5 * 6 * flight;
        water.spawn({ pos: start, vel, life: flight + 0.2, size: rand(0.8, 1.2), onLand: (p) => splashAt(p.pos, 2) });
      }
    },

    // Посадка: комочки земли
    dirt(at) {
      for (let i = 0; i < 10; i++) {
        dirt.spawn({
          pos: at.clone().add(new THREE.Vector3(0, 0.05, 0)),
          vel: new THREE.Vector3(rand(-0.6, 0.6), rand(1, 1.8), rand(-0.6, 0.6)),
          life: 0.8, size: rand(0.7, 1.3), spin: rand(-6, 6),
        });
      }
    },

    // Сбор урожая: золотые искры вверх
    sparkle(at) {
      for (let i = 0; i < 16; i++) {
        const a = rand(0, Math.PI * 2);
        sparks.spawn({
          pos: at.clone().add(new THREE.Vector3(0, 0.3, 0)),
          vel: new THREE.Vector3(Math.cos(a) * rand(0.4, 1), rand(1, 2), Math.sin(a) * rand(0.4, 1)),
          life: rand(0.6, 1), gravity: 0.25, spin: rand(-4, 4),
        });
      }
    },

    // Корзинка: монетки подпрыгивают и падают обратно
    coins(at) {
      for (let i = 0; i < 6; i++) {
        coins.spawn({
          pos: at.clone().add(new THREE.Vector3(0, 0.45, 0)),
          vel: new THREE.Vector3(rand(-0.5, 0.5), rand(2, 3), rand(-0.5, 0.5)),
          life: 1.2, spin: rand(-8, 8), gravity: 1,
        });
      }
    },

    // ripeMushrooms — точки спелых грибов; visibility — насколько видно (дождь гасит пылинки и споры);
    // lamps — горят ли фонари (днём пылинок в их свете нет)
    update(dt, { ripeMushrooms = [], visibility = 1, lamps = 1 } = {}) {
      // споры поднимаются над спелыми грибами
      sporeTimer -= dt;
      if (ripeMushrooms.length && sporeTimer <= 0 && visibility > 0.3) {
        sporeTimer = EFFECTS.sporeEvery / Math.max(1, ripeMushrooms.length / 3);
        const at = ripeMushrooms[Math.floor(Math.random() * ripeMushrooms.length)];
        spores.spawn({
          pos: at.clone().add(new THREE.Vector3(rand(-0.2, 0.2), 0.7, rand(-0.2, 0.2))),
          vel: new THREE.Vector3(rand(-0.08, 0.08), rand(0.15, 0.3), rand(-0.08, 0.08)),
          life: rand(3, 5), gravity: 0,
        });
      }
      // пылинки медленно кружат в свете фонарей
      dustTimer -= dt;
      if (lanternLights.length && dustTimer <= 0 && visibility > 0.3 && lamps > 0.3) {
        dustTimer = 0.25 / k;
        const at = lanternLights[Math.floor(Math.random() * lanternLights.length)];
        dust.spawn({
          pos: at.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.9, 0), rand(-0.4, 0.4))),
          vel: new THREE.Vector3(rand(-0.05, 0.05), rand(-0.03, 0.05), rand(-0.05, 0.05)),
          life: rand(3, 6), gravity: 0,
        });
      }

      water.update(dt, () => 1);
      splash.update(dt, (p, t) => 1 - t);
      dirt.update(dt, (p, t) => 1 - t * 0.5);
      sparks.update(dt, (p, t) => Math.sin(Math.PI * Math.min(1, t * 1.3)));
      coins.update(dt, (p, t) => (t > 0.8 ? (1 - t) * 5 : 1));
      dust.update(dt, (p, t) => Math.sin(Math.PI * t) * visibility * lamps);
      spores.update(dt, (p, t) => Math.sin(Math.PI * t) * (0.8 + 0.2 * Math.sin(p.age * 8)));
    },
  };
}
