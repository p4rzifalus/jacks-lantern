// Портрет фонаря Джека — пиксельный, рисуется кодом. Стоит рядом с его репликами.
// Кадр 24×24. Пламя внутри стекла — его лицо: глаза и рот. Днём Джек сонный (огонь маленький, глаза закрыты),
// вечером и ночью — бодрый. Пока говорит, рот открывается и закрывается; в паузах огонь чуть колышется.
import { PixelSheet } from './pixels.js';

export const PORTRAIT_SIZE = 24;
// Колонки листа: [бодрый: рот закрыт, рот открыт, колышется] [сонный: закрыт, открыт]
export const PORTRAIT_FRAMES = { awake: 0, awakeTalk: 1, awakeSway: 2, sleepy: 3, sleepyTalk: 4 };

const IRON = '#3b3530';
const IRON_LIGHT = '#6a5d50';
const GLASS = '#ffc566';       // стекло, когда горит
const GLASS_DIM = '#b98a4a';   // днём — тусклое
const FLAME = '#fff2bf';
const FLAME_EDGE = '#ffdc7a';
const FACE = '#6a3410';        // глаза и рот

function drawBody(d, glass) {
  d.line(10, 0, 13, 0, IRON);        // кольцо-дужка
  d.px(9, 1, IRON);
  d.px(14, 1, IRON);
  d.rect(8, 2, 8, 1, IRON);          // шапка
  d.rect(5, 3, 14, 2, IRON);
  d.line(6, 3, 17, 3, IRON_LIGHT);   // блик на шапке
  d.rect(5, 5, 14, 14, glass, true); // стекло светится
  d.line(5, 5, 5, 18, IRON);         // рамка
  d.line(18, 5, 18, 18, IRON);
  d.rect(5, 19, 14, 2, IRON);        // донышко
  d.rect(6, 21, 12, 1, IRON_LIGHT);
}

// Глаз: 2×3 с бликом в уголке
function eye(d, x, y) {
  d.rect(x, y, 2, 3, FACE);
  d.px(x, y, '#ffffff');
}

// Бодрое пламя — во всё стекло, глаза открыты. sway — язычок наклонён; talk — рот открыт
function drawAwake(d, { sway = 0, talk = false } = {}) {
  drawBody(d, GLASS);
  d.ellipse(11.5, 13.5, 5, 5, FLAME_EDGE, true);
  d.ellipse(11.5, 14, 4, 4, FLAME, true);
  d.rect(11 + sway, 7, 2, 2, FLAME_EDGE, true); // кончик пламени
  d.px(12 + sway, 6, FLAME_EDGE, true);
  eye(d, 8, 11);
  eye(d, 14, 11);
  if (talk) {
    d.rect(10, 15, 4, 2, FACE);
    d.rect(11, 17, 2, 1, FACE);
  } else d.line(10, 16, 13, 16, FACE);
}

// Сонное пламя: поменьше, глаза закрыты
function drawSleepy(d, { talk = false } = {}) {
  drawBody(d, GLASS_DIM);
  d.ellipse(11.5, 14.5, 4, 3.5, FLAME_EDGE, true);
  d.ellipse(11.5, 15, 3, 2.5, FLAME, true);
  d.px(12, 10, FLAME_EDGE, true);
  d.line(8, 14, 9, 14, FACE);   // закрытые глаза
  d.line(14, 14, 15, 14, FACE);
  if (talk) d.rect(11, 16, 2, 2, FACE);
  else d.line(11, 17, 12, 17, FACE);
}

// Лист портретов → canvas (колонки — PORTRAIT_FRAMES)
export function drawJackPortraits() {
  const n = PORTRAIT_SIZE;
  const sheet = new PixelSheet(n * 5, n);
  const f = (col) => sheet.frame(col, 0, n, n);
  drawAwake(f(PORTRAIT_FRAMES.awake));
  drawAwake(f(PORTRAIT_FRAMES.awakeTalk), { talk: true });
  drawAwake(f(PORTRAIT_FRAMES.awakeSway), { sway: -1 });
  drawSleepy(f(PORTRAIT_FRAMES.sleepy));
  drawSleepy(f(PORTRAIT_FRAMES.sleepyTalk), { talk: true });
  return sheet.finish().toCanvas();
}

// Живой портрет: <canvas>, который сам меняет кадр. update(dt, { talking, awake }) — каждый кадр игры
export function createPortrait() {
  const sheet = drawJackPortraits();
  const canvas = document.createElement('canvas');
  canvas.className = 'jack-portrait';
  canvas.width = canvas.height = PORTRAIT_SIZE;
  const ctx = canvas.getContext('2d');
  let shown = -1;
  let time = 0;
  const show = (col) => {
    if (col === shown) return;
    shown = col;
    ctx.clearRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
    ctx.drawImage(sheet, col * PORTRAIT_SIZE, 0, PORTRAIT_SIZE, PORTRAIT_SIZE, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
  };
  show(PORTRAIT_FRAMES.awake);
  return {
    canvas,
    update(dt, { talking = false, awake = true } = {}) {
      time += dt;
      const F = PORTRAIT_FRAMES;
      const mouth = talking && Math.floor(time * 7) % 2 === 1; // рот — 7 раз в секунду
      if (!awake) return show(mouth ? F.sleepyTalk : F.sleepy);
      if (mouth) return show(F.awakeTalk);
      show(Math.floor(time * 1.6) % 3 === 2 ? F.awakeSway : F.awake); // огонь изредка колышется
    },
  };
}
