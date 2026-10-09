// Портрет фонаря Джека — пиксельный, рисуется кодом. Стоит рядом с его репликами.
// Кадр 24×30. Фонарь — по референсу docs/jack-lantern-ref.png: кольцо сверху, красный поясок, крыша с загнутыми
// краями, высокий шестигранный корпус, сужается книзу (широкое стекло спереди, узкие по бокам, рамки), основание и шишечка снизу.
// На переднем стекле — лицо: брови (левая приподнята — Джек ироничный), глаза и рот.
// Днём Джек сонный (стекло почти погасло, глаза закрыты), вечером и ночью — бодрый.
// Пока говорит, рот открывается и закрывается; в паузах огонь за стеклом чуть колышется.
import { PixelSheet } from './pixels.js';

export const PORTRAIT_W = 24;
export const PORTRAIT_H = 30;
// Колонки листа: [бодрый: рот закрыт, рот открыт, колышется] [сонный: закрыт, открыт]
export const PORTRAIT_FRAMES = { awake: 0, awakeTalk: 1, awakeSway: 2, sleepy: 3, sleepyTalk: 4 };

const IRON = '#3a3a2a';        // тёмная бронза
const IRON_LIGHT = '#77744c';  // светлая бронза: кольцо, края
const BAND = '#ff5a2a';        // красный поясок под кольцом
const BAND_DIM = '#7a3020';
const SIDE = '#e8701e';        // боковые стёкла
const SIDE_DIM = '#6e4428';
const FRONT = '#ffa63a';       // переднее стекло
const FRONT_DIM = '#8a5a30';
const HOT = '#ffe08a';         // огонь за стеклом — самое яркое
const FACE = '#3a1206';        // брови, глаза и рот

// Корпус фонаря. lit — горит ли: от этого цвет стёкол и пояска
function drawBody(d, lit) {
  d.line(10, 0, 13, 0, IRON_LIGHT);     // кольцо
  d.line(9, 1, 9, 3, IRON_LIGHT);
  d.line(14, 1, 14, 3, IRON_LIGHT);
  d.line(10, 4, 13, 4, IRON_LIGHT);
  d.rect(11, 5, 2, 1, IRON);
  d.rect(10, 6, 4, 1, lit ? BAND : BAND_DIM, lit); // поясок
  d.rect(9, 7, 6, 1, IRON);
  d.rect(7, 8, 10, 1, IRON);            // крыша
  d.rect(5, 9, 14, 1, IRON);
  d.rect(3, 10, 18, 1, IRON);
  d.px(2, 9, IRON);                     // загнутые края крыши
  d.px(21, 9, IRON);
  d.line(8, 8, 6, 9, IRON_LIGHT);       // блик на скате
  d.rect(4, 11, 16, 1, IRON_LIGHT);     // край крыши
  // корпус сужается книзу: каждые 4 строки — на пиксель с каждой стороны
  for (let y = 12; y <= 23; y++) {
    const k = Math.floor((y - 12) / 4);
    d.rect(5 + k, y, 14 - 2 * k, 1, IRON);                         // рама
    if (y === 12) continue;
    d.px(6 + k, y, lit ? SIDE : SIDE_DIM, lit);                    // боковые стёкла
    d.px(17 - k, y, lit ? SIDE : SIDE_DIM, lit);
    d.rect(8 + (k > 1 ? 1 : 0), y, 8 - (k > 1 ? 2 : 0), 1, lit ? FRONT : FRONT_DIM, lit); // переднее
  }
  d.rect(7, 24, 10, 1, IRON_LIGHT);     // низ рамы
  d.rect(6, 25, 12, 1, IRON);           // основание
  d.rect(8, 26, 8, 1, IRON);
  d.rect(10, 27, 4, 1, IRON);           // шишечка
  d.rect(11, 28, 2, 1, IRON);
}

// Глаз: 2×2 с бликом в уголке
function eye(d, x, y) {
  d.rect(x, y, 2, 2, FACE);
  d.px(x, y, '#fff6dc');
}

// Бодрый: за стеклом огонь. sway — огонь качнулся; talk — рот открыт
function drawAwake(d, { sway = 0, talk = false } = {}) {
  drawBody(d, true);
  d.ellipse(11.5 + sway, 18.5, 2.5, 4.5, HOT, true); // огонь за стеклом — посередине, лицо на нём
  // брови: левая приподнята дугой, правая — ниже и прямо (ироничный взгляд)
  d.px(8, 16, FACE);
  d.line(9, 15, 10, 15, FACE);
  d.line(13, 16, 15, 16, FACE);
  eye(d, 9, 17);
  eye(d, 13, 17);
  if (talk) {
    d.rect(10, 20, 4, 2, FACE);
  } else {
    d.line(10, 20, 12, 20, FACE); // усмешка: правый уголок вверх
    d.px(13, 19, FACE);
  }
}

// Сонный: стекло почти погасло, огонёк еле тлеет, глаза закрыты
function drawSleepy(d, { talk = false } = {}) {
  drawBody(d, false);
  d.ellipse(11.5, 22, 2, 1, FRONT, true);
  d.line(9, 18, 10, 18, FACE);
  d.line(13, 18, 14, 18, FACE);
  if (talk) d.rect(11, 20, 2, 2, FACE);
  else d.line(11, 20, 12, 20, FACE);
}

// Лист портретов (колонки — PORTRAIT_FRAMES), ещё не картинка
export function drawJackSheet() {
  const sheet = new PixelSheet(PORTRAIT_W * 5, PORTRAIT_H);
  const f = (col) => sheet.frame(col, 0, PORTRAIT_W, PORTRAIT_H);
  drawAwake(f(PORTRAIT_FRAMES.awake));
  drawAwake(f(PORTRAIT_FRAMES.awakeTalk), { talk: true });
  drawAwake(f(PORTRAIT_FRAMES.awakeSway), { sway: -1 });
  drawSleepy(f(PORTRAIT_FRAMES.sleepy));
  drawSleepy(f(PORTRAIT_FRAMES.sleepyTalk), { talk: true });
  return sheet.finish();
}

// Лист портретов → canvas
export function drawJackPortraits() {
  return drawJackSheet().toCanvas();
}

// Живой портрет: <canvas>, который сам меняет кадр. update(dt, { talking, awake }) — каждый кадр игры
export function createPortrait() {
  const sheet = drawJackPortraits();
  const canvas = document.createElement('canvas');
  canvas.className = 'jack-portrait';
  canvas.width = PORTRAIT_W;
  canvas.height = PORTRAIT_H;
  const ctx = canvas.getContext('2d');
  let shown = -1;
  let time = 0;
  const show = (col) => {
    if (col === shown) return;
    shown = col;
    ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);
    ctx.drawImage(sheet, col * PORTRAIT_W, 0, PORTRAIT_W, PORTRAIT_H, 0, 0, PORTRAIT_W, PORTRAIT_H);
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
