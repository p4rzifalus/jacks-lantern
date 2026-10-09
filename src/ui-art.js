// Картинки интерфейса (стиль «пергаментная карточка», этап 14а): бумага, карточка-рамка, лоза, завиток, разделитель.
// Берём из art/web/ui (npm run art), иначе — оригинал из art/, иначе — заглушку, нарисованную здесь же.
// Каждая картинка становится CSS-переменной (--ui-card…), стили — в ui.css.
import './ui.css';

const webArt = import.meta.glob('../art/web/ui/*.webp', { eager: true, query: '?url', import: 'default' });
const userArt = import.meta.glob('../art/ui-*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
function artFile(name) {
  const web = webArt[`../art/web/ui/${name}.webp`];
  if (web) return web;
  const own = Object.entries(userArt).find(([file]) => file.replace(/^.*\//, '').replace(/\.[^.]+$/, '') === name);
  return own?.[1];
}

// --- Заглушки (пока нет картинок) ---------------------------------------------

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
  return c; // холст: из него и картинка-заглушка бумаги, и узор для карточки
}

// Лоза в левом верхнем углу: стебель вверх по левому краю и вдоль верхнего
function vine(leaf = '#6f8f3a', dark = '#3f5a22') {
  const leaves = [[12, 100, -80], [10, 70, -100], [16, 40, -60], [40, 14, -20], [70, 10, 10], [100, 12, -10]];
  const l = leaves.map(([x, y, a], i) => `<g transform="translate(${x} ${y}) rotate(${a})">
      <path d="M0 0 C6 -7 16 -7 22 0 C16 7 6 7 0 0Z" fill="${i % 2 ? leaf : '#88a44a'}" stroke="${dark}" stroke-width="1.4"/></g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
    <path d="M10 126 C8 60 30 10 126 10" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>${l}</svg>`;
  return svg;
}

// Завиток у заголовка, смотрит вправо: ~ Семена ~
function flourish(color = '#6b4a2a') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 14">
    <path d="M8 7 C4 7 4 2 8 3 C10 4 9 7 7 7 C20 7 30 11 46 7" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M46 7 C49 2 55 2 58 4 C54 6 50 7 46 7Z M46 7 C49 11 55 11 58 9 C54 8 50 7 46 7Z" fill="#7d9440" stroke="${color}" stroke-width="0.8"/></svg>`;
}

// Разделитель: волнистая лоза с листиками и цветком посередине
function divider(color = '#6b4a2a') {
  const leaves = [20, 50, 80, 120, 150, 180].map((x, i) =>
    `<path transform="translate(${x} ${i % 2 ? 9 : 5}) rotate(${i % 2 ? 20 : -20})" d="M0 0 C3 -3 8 -3 10 0 C8 3 3 3 0 0Z" fill="#7d9440" stroke="${color}" stroke-width="0.6"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 14">
    <path d="M4 7 C40 2 60 12 100 7 C140 2 160 12 196 7" fill="none" stroke="${color}" stroke-width="1.2"/>${leaves}
    <circle cx="100" cy="7" r="4.5" fill="#f4ead2" stroke="${color}" stroke-width="0.8"/><circle cx="100" cy="7" r="1.6" fill="#d9a23a"/></svg>`;
}

// Карточка-рамка: скруглённый лист с чернильным контуром и подрумяненным краем
function card() {
  const [c, g] = canvas(128);
  const shape = () => { g.beginPath(); g.roundRect(3, 3, 122, 122, 14); };
  shape();
  g.fillStyle = g.createPattern(paper(11), 'repeat');
  g.fill();
  const toast = g.createRadialGradient(64, 64, 30, 64, 64, 92);
  toast.addColorStop(0, 'rgba(190,120,50,0)');
  toast.addColorStop(1, 'rgba(190,120,50,0.45)');
  g.fillStyle = toast;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#4e2f17';
  shape();
  g.stroke();
  return c.toDataURL();
}

const svgUrl = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

// Положить картинки в CSS-переменные. Один раз, при запуске игры
export function initUIArt() {
  const vars = {
    '--ui-paper': artFile('ui-paper') || paper(11).toDataURL(),
    '--ui-card': artFile('ui-card') || card(),
    '--ui-vine': artFile('ui-vine') || svgUrl(vine()),
    '--ui-flourish': artFile('ui-flourish') || svgUrl(flourish()),
    '--ui-divider': artFile('ui-divider') || svgUrl(divider()),
  };
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, `url("${v}")`);
  // где «резать» карточку: углы и край с контуром не растягиваются (в точках картинки)
  root.setProperty('--ui-card-slice', artFile('ui-card') ? '64' : '22');
}
