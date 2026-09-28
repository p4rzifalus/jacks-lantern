// Звук игры целиком: пульт (engine), звуки действий, фон природы и музыка.
// Всё создаётся в коде — файлов нет. Громкости — в config.js → SOUND.
import { SOUND, DECOR } from '../config.js';
import { createAudioEngine } from './engine.js';
import { createSfx } from './sfx.js';
import { createAmbience } from './ambience.js';
import { createMusic } from './music.js';

export function createSound() {
  const engine = createAudioEngine();
  const sfx = createSfx(engine);
  const ambience = createAmbience(engine);
  createMusic(engine);

  let walked = 0; // сколько герой прошёл с прошлого шага
  let lastPos = null;

  return {
    engine,
    ...sfx,

    // Каждый кадр: шаги по пройденному пути, ветер и дождь по погоде
    // onSoil — стоит ли герой на грядке (там шаги мягче)
    update(dt, { heroPosition, onSoil, windStrength, rain }) {
      if (lastPos) {
        const d = Math.hypot(heroPosition.x - lastPos.x, heroPosition.z - lastPos.z);
        walked = d > 0.0005 ? walked + d : SOUND.stepEvery * 0.6; // встал — следующий шаг наступит скоро
        if (walked >= SOUND.stepEvery) {
          walked -= SOUND.stepEvery;
          sfx.step(onSoil);
        }
      }
      lastPos = { x: heroPosition.x, z: heroPosition.z };
      ambience.update(dt, { windStrength: DECOR.wind ? windStrength / DECOR.wind : 0, rain });
    },
  };
}
