// Огоньки на земле: остаются от прогнанных духов, висят в воздухе и мерцают.
// Енот подбирает огонёк, проходя рядом; на рассвете несобранные сами улетают в счётчик — ничего не теряется.
import * as THREE from 'three';
import { SPIRITS, CELL_SIZE } from '../config.js';
import { Sprite } from '../render/sprites.js';
import { getSheets } from './sheets.js';
import { SPIRIT } from '../art/sprite-art.js';
import { unregisterSprite } from '../render/view-angle.js';

const REACH = 4.4; // до куда может дойти енот (огород и дорожка вокруг)

// onCollect(position) — огонёк подобран (или прилетел сам утром)
export function createEmbers(scene, { onCollect }) {
  const sheet = getSheets().spirits;
  const list = [];

  function remove(e) {
    scene.remove(e.sprite.object);
    unregisterSprite(e.sprite.object);
    list.splice(list.indexOf(e), 1);
  }

  return {
    get count() { return list.length; },

    // Огонёк появился там, где дух испугался (сдвигаем внутрь, куда енот может дойти: огород и дорожка)
    add(at) {
      const sprite = new Sprite(sheet, { castShadow: false });
      sprite.object.position.set(THREE.MathUtils.clamp(at.x, -REACH, REACH), 0, THREE.MathUtils.clamp(at.z, -REACH, REACH));
      sprite.mesh.scale.setScalar(0.7);
      scene.add(sprite.object);
      list.push({ sprite, phase: Math.random() * 10, flying: false, t: 0 });
    },

    update(dt, time, heroPosition) {
      for (const e of [...list]) {
        const pos = e.sprite.object.position;
        e.sprite.setFrame(1 + (Math.floor(time * 8 + e.phase) % 4), SPIRIT.rows_.coin);
        if (e.flying) {
          // утром: взлетает и тает
          e.t += dt;
          pos.y += dt * 2.5;
          e.sprite.mesh.scale.setScalar(0.7 * Math.max(0, 1 - e.t));
          if (e.t >= 1) {
            onCollect(pos.clone());
            remove(e);
          }
          continue;
        }
        pos.y = 0.35 + Math.sin(time * 2 + e.phase) * 0.08; // покачивается
        if (heroPosition && Math.hypot(heroPosition.x - pos.x, heroPosition.z - pos.z) < SPIRITS.emberReach * CELL_SIZE) {
          onCollect(pos.clone());
          remove(e);
        }
      }
    },

    // Рассвет: все несобранные огоньки сами улетают в счётчик
    dawn() {
      for (const e of list) e.flying = true;
    },
  };
}
