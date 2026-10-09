// Стиль окон «Б · пергаментная карточка» (выбран в этапе 14а). Пока — только магазин, весь интерфейс — в 14б.
// Включается переключателем в панели G или ?ui=b. Рамки, бумага и лоза — картинки (задания в ART.md → «Интерфейс»),
// значки остаются пиксельными. Пока картинок нет, бумага и украшения рисуются здесь же, в коде, — как заглушки.
import './ui-skins.css';

export const UI_SKINS = {
  '': 'нынешний (стекло)',
  b: 'Б · пергаментная карточка',
};

const STORAGE_KEY = 'ogorod2-ui';

// --- Текстуры-заглушки -----------------------------------------------------------

// Случайные числа с зерном: одна и та же картинка при каждом запуске
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Плавный шум, бесшовный по краям: сумма слоёв от крупных пятен до мелких
function noise(size, seed, layers = [[4, 0.5], [8, 0.3], [16, 0.15], [32, 0.05]]) {
  const rnd = random(seed);
  const out = new Float32Array(size * size);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (const [cells, weight] of layers) {
    const grid = Array.from({ length: cells * cells }, rnd);
    const at = (x, y) => grid[(y % cells) * cells + (x % cells)];
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells;
      const y0 = Math.floor(gy);
      const ty = smooth(gy - y0);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells;
        const x0 = Math.floor(gx);
        const tx = smooth(gx - x0);
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        out[y * size + x] += (top * (1 - ty) + bottom * ty) * weight;
      }
    }
  }
  return out;
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Заливка по шуму: от светлого к тёмному цвету + мелкая «зернистость»
function noiseFill(size, seed, light, dark, grain = 10) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const n = noise(size, seed);
  const rnd = random(seed + 1);
  const [l, d] = [hex(light), hex(dark)];
  for (let i = 0; i < size * size; i++) {
    const col = mix(l, d, Math.min(1, Math.max(0, (n[i] - 0.3) * 1.6)));
    const r = (rnd() - 0.5) * grain;
    img.data.set([col[0] + r, col[1] + r, col[2] + r, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  return [c, g, rnd];
}

// Бумага: пятна, волокна и крапинки
function paper(seed, light = '#f1e3c2', dark = '#d8bf92') {
  const size = 256;
  const [c, g, rnd] = noiseFill(size, seed, light, dark, 8);
  // рисуем со сдвигами, чтобы штрих у края продолжился с другой стороны (бесшовно)
  const wrap = (draw) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy); };
  g.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, len = 4 + rnd() * 14;
    g.strokeStyle = `rgba(${rnd() < 0.5 ? '120,90,50' : '255,250,235'},${0.06 + rnd() * 0.08})`;
    wrap((dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); g.stroke(); });
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(100,70,35,${0.08 + rnd() * 0.15})`;
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd(), 1 + rnd());
  }
  return c.toDataURL();
}

// Лоза для углов окна: стебель-дуга и листья. Рисованная, не пиксельная — это часть рамки.
function vine(leaf = '#6f8f3a', dark = '#3f5a22') {
  const leaves = [[18, 70, -40], [34, 44, -70], [58, 24, -100], [86, 14, -130], [110, 12, -170], [12, 100, -10]];
  const l = leaves.map(([x, y, a], i) => `<g transform="translate(${x} ${y}) rotate(${a})">
      <path d="M0 0 C6 -7 16 -7 22 0 C16 7 6 7 0 0Z" fill="${i % 2 ? leaf : '#88a44a'}" stroke="${dark}" stroke-width="1.4"/>
      <path d="M2 0 L18 0" stroke="${dark}" stroke-width="0.8" opacity="0.6"/></g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
    <path d="M4 126 C6 70 40 20 126 6" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 60 C20 50 22 40 30 38" fill="none" stroke="${dark}" stroke-width="1.6"/>${l}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Завиток у заголовка: ~ Семена ~
function flourish(color = '#7a5a36') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 16">
    <path d="M2 8 C14 8 18 2 26 4 C32 6 30 12 25 11 C21 10 23 6 27 6 C36 6 44 8 58 8" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M44 8 C46 4 50 3 52 5 C50 7 47 8 44 8Z" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let made = false;
function makeTextures() {
  if (made) return;
  made = true;
  const vars = {
    '--ui-paper': paper(11),
    '--ui-paper-dark': paper(12, '#e4cfa4', '#c6a774'),
    '--ui-vine': vine(),
    '--ui-flourish': flourish(),
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, `url("${v}")`);
  // Книжный шрифт с кириллицей. Для пробы — с Google Fonts; если выберем, в 14б положим файл в public/fonts
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Alegreya:wght@400;500;700&family=Alegreya+SC:wght@500;700&display=swap';
  document.head.appendChild(font);
}

// --- Переключение ------------------------------------------------------------

export function setUISkin(name) {
  if (!(name in UI_SKINS)) name = '';
  if (name) makeTextures();
  if (name) document.body.dataset.ui = name;
  else delete document.body.dataset.ui;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch { /* не страшно */ }
  window.dispatchEvent(new Event('uiskin'));
}

export function initUISkin() {
  const fromUrl = new URLSearchParams(location.search).get('ui');
  let saved = '';
  try {
    saved = localStorage.getItem(STORAGE_KEY) || '';
  } catch { /* нет сохранённого */ }
  const name = fromUrl ?? (import.meta.env.DEV ? saved : '');
  if (name) setUISkin(name);
}
