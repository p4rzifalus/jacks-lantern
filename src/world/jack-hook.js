// Джек на крюке у двери: пиксельный фонарь, днём спит (тусклый), вечером и ночью горит и ждёт, когда его возьмут.
// Правила (когда можно взять, когда возвращается) — в main.js, где висит — config.js → JACK.hook.
import * as THREE from 'three';
import { JACK } from '../config.js';
import { Sprite } from '../render/sprites.js';
import { getSheets } from './sheets.js';
import { TOOL_FRAMES } from '../art/sprite-art.js';

const SCALE = 0.8; // как у фонаря на поясе енота (hero.js)

export function createJackHook(scene) {
  const sprite = new Sprite(getSheets().tools);
  sprite.mesh.scale.setScalar(SCALE);
  sprite.object.position.set(JACK.hook.x, JACK.hook.y, JACK.hook.z);
  scene.add(sprite.object);
  let flare = 0; // сколько ещё секунд гореть, проснувшись (вступление, «разбудили» днём)

  return {
    object: sprite.object,
    // точка, к которой идёт енот, и где появляются искорки
    position: new THREE.Vector3(JACK.hook.x, JACK.hook.y + 0.2, JACK.hook.z),

    // Проснуться на seconds секунд: загореться даже днём
    wake(seconds = 3) {
      flare = Math.max(flare, seconds);
    },
    sleep() {
      flare = 0;
    },
    get awake() { return flare > 0; },

    // visible — висит ли Джек на крюке; lamps — горят ли фонари (вечер и ночь).
    // Возвращает, насколько Джек сейчас светится сверх обычного (для света у двери)
    update(dt, { visible, lamps }) {
      flare = Math.max(0, flare - dt);
      sprite.object.visible = visible;
      const lit = lamps > 0.3 || flare > 0;
      sprite.setFrame(...(lit ? TOOL_FRAMES.lantern : TOOL_FRAMES.lanternOff));
      return Math.min(1, flare);
    },
  };
}
