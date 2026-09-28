// Все листы спрайтов игры — создаются один раз и используются всеми спрайтами.
import { createSheet } from '../render/sprites.js';
import {
  drawHeroSheet, drawPlantSheet, drawHeldSheet, drawDecorSheet, drawSmokeSheet,
  HERO, HERO_SKINS, PLANT_FRAME, HELD_FRAME, DECOR_FRAME, SMOKE_FRAME,
} from '../art/sprite-art.js';

let sheets = null;

export function getSheets() {
  if (!sheets) {
    sheets = {
      // герой: по листу на каждый скин (свой рисунок — art/raccoon.png, art/mole.png)
      hero: Object.fromEntries(HERO_SKINS.map((skin) => [skin, createSheet(skin, () => drawHeroSheet(skin), HERO.frameW, HERO.frameH)])),
      plants: createSheet('plants', drawPlantSheet, PLANT_FRAME.frameW, PLANT_FRAME.frameH, { glowStrength: 0.45 }),
      held: createSheet('held', drawHeldSheet, HELD_FRAME.frameW, HELD_FRAME.frameH, { glowStrength: 0.45 }),
      decor: createSheet('decor', drawDecorSheet, DECOR_FRAME.frameW, DECOR_FRAME.frameH),
      smoke: createSheet('smoke', drawSmokeSheet, SMOKE_FRAME.frameW, SMOKE_FRAME.frameH),
    };
  }
  return sheets;
}
