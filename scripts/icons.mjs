// Значки игры — фонарь Джек: npm run icons
// Берёт тот же пиксельный портрет, что у реплик Джека (src/art/jack-art.js), и кладёт в public/:
//   favicon-16.png — вкладка браузера, отдельный крошечный рисунок (портрет в 16 точек не влезает);
//   favicon-32.png, favicon.png (64) — вкладка на обычном и чётком экране, портрет как есть;
//   apple-touch-icon.png (180) — iPhone, «На экран Домой»;
//   icon-192.png, icon-512.png — Android и установка игры как приложения (site.webmanifest).
// Большие значки: тёмный фон как у игры, за фонарём — тёплое свечение. Фонарь занимает ~2/3 высоты,
// чтобы Android мог обрезать значок кругом или «каплей» и ничего не срезал.
import path from 'node:path';
import sharp from 'sharp';
import { PixelSheet } from '../src/art/pixels.js';
import { drawJackSheet, PORTRAIT_W, PORTRAIT_H, PORTRAIT_FRAMES } from '../src/art/jack-art.js';

const OUT = path.resolve('public');
const BG = '#171722';       // фон — как у страницы игры (index.html)
const GLOW = '#ffa63a';     // свечение за фонарём — цвет его стекла

// Лист пикселей → сырые RGBA-байты одного кадра
function frameRGBA(sheet, col, w, h) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = sheet.color[y * sheet.width + col * w + x];
      if (c) data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return data;
}

// Портрет Джека (бодрый) — 24×30
const jack = frameRGBA(drawJackSheet(), PORTRAIT_FRAMES.awake, PORTRAIT_W, PORTRAIT_H);
const jackPng = () => sharp(jack, { raw: { width: PORTRAIT_W, height: PORTRAIT_H, channels: 4 } }).png();

// Крошечный Джек 16×16 — те же цвета, меньше деталей: кольцо, поясок, крыша, стекло с огнём, глаза
function drawTinyJack() {
  const s = new PixelSheet(16, 16);
  const d = s.frame(0, 0, 16, 16);
  d.line(7, 0, 8, 0, '#77744c');        // кольцо
  d.px(6, 1, '#77744c');
  d.px(9, 1, '#77744c');
  d.rect(6, 2, 4, 1, '#ff5a2a', true);  // поясок
  d.rect(4, 3, 8, 1, '#3a3a2a');        // крыша
  d.rect(2, 4, 12, 1, '#77744c');       // край крыши
  for (let y = 5; y <= 11; y++) {
    const k = y >= 9 ? 1 : 0;           // корпус сужается книзу
    d.rect(3 + k, y, 10 - 2 * k, 1, '#3a3a2a');
    if (y === 5) continue;
    d.px(4 + k, y, '#e8701e', true);    // боковые стёкла
    d.px(11 - k, y, '#e8701e', true);
    d.rect(5 + k, y, 6 - 2 * k, 1, '#ffa63a', true); // переднее
  }
  d.rect(6, 6, 4, 5, '#ffe08a', true);  // огонь за стеклом
  d.px(6, 7, '#3a1206');                // глаза
  d.px(9, 7, '#3a1206');
  d.line(7, 9, 8, 9, '#3a1206');        // рот
  d.rect(4, 12, 8, 1, '#3a3a2a');       // основание
  d.line(7, 13, 8, 13, '#3a3a2a');      // шишечка
  return frameRGBA(s.finish(), 0, 16, 16);
}

// Фонарь крупно (пиксели — ровными квадратами) по центру на тёмном фоне со свечением
async function bigIcon(size, scale, file) {
  const w = PORTRAIT_W * scale;
  const h = PORTRAIT_H * scale;
  const lantern = await jackPng().resize(w, h, { kernel: 'nearest' }).toBuffer();
  const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="g" cx="50%" cy="56%" r="50%">
      <stop offset="0" stop-color="${GLOW}" stop-opacity="0.8"/>
      <stop offset="0.45" stop-color="${GLOW}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${GLOW}" stop-opacity="0"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="${BG}"/>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`);
  await sharp(glow)
    .composite([{ input: lantern, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toFile(path.join(OUT, file));
}

// Вкладка: прозрачный фон, фонарь по центру квадрата
async function tabIcon(size, scale, file) {
  const w = PORTRAIT_W * scale;
  const h = PORTRAIT_H * scale;
  const lantern = await jackPng().resize(w, h, { kernel: 'nearest' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: lantern, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toFile(path.join(OUT, file));
}

await sharp(drawTinyJack(), { raw: { width: 16, height: 16, channels: 4 } }).png().toFile(path.join(OUT, 'favicon-16.png'));
await tabIcon(32, 1, 'favicon-32.png');
await tabIcon(64, 2, 'favicon.png');
await bigIcon(180, 5, 'apple-touch-icon.png');
await bigIcon(192, 4, 'icon-192.png');
await bigIcon(512, 11, 'icon-512.png');
console.log('Значки готовы: public/favicon-16.png, favicon-32.png, favicon.png, apple-touch-icon.png, icon-192.png, icon-512.png');
