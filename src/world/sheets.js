// Все листы спрайтов игры — создаются один раз и используются всеми спрайтами.
import { createSheet } from '../render/sprites.js';
import {
  drawHeroSheet, drawPlantSheet, drawHeldSheet, drawToolSheet, drawDecorSheet, drawSmokeSheet, drawSpiritSheet, drawFxSheet,
  HERO, HERO_SKINS, PLANT_FRAME, HELD_FRAME, TOOL_FRAME, DECOR_FRAME, SMOKE_FRAME, SPIRIT, FX,
} from '../art/sprite-art.js';

let sheets = null;

export function getSheets() {
  if (!sheets) {
    sheets = {
      // герой: по листу на каждый скин (свой рисунок — art/raccoon.png, art/mole.png)
      hero: Object.fromEntries(HERO_SKINS.map((skin) => [skin, createSheet(skin, () => drawHeroSheet(skin), HERO.frameW, HERO.frameH)])),
      plants: createSheet('plants', drawPlantSheet, PLANT_FRAME.frameW, PLANT_FRAME.frameH, { glowStrength: 0.45 }),
      held: createSheet('held', drawHeldSheet, HELD_FRAME.frameW, HELD_FRAME.frameH, { glowStrength: 0.45 }),
      tools: createSheet('tools', drawToolSheet, TOOL_FRAME.frameW, TOOL_FRAME.frameH), // лейка, корзинка, мешочки с семенами
      decor: createSheet('decor', drawDecorSheet, DECOR_FRAME.frameW, DECOR_FRAME.frameH),
      smoke: createSheet('smoke', drawSmokeSheet, SMOKE_FRAME.frameW, SMOKE_FRAME.frameH),
      spirits: createSheet('spirits', drawSpiritSheet, SPIRIT.frameW, SPIRIT.frameH, { glowStrength: 0.3 }), // духи ночью светятся
      fx: createSheet('fx', drawFxSheet, FX.frameW, FX.frameH, { glowStrength: 0.8 }), // искры и вспышки боя
    };
  }
  return sheets;
}
