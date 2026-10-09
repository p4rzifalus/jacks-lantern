// Готовит картинки из art/ для игры: npm run art
// Твои оригиналы в art/ не трогаются. Для игры рядом, в art/web/, появляются лёгкие копии:
//   art/web/1024/<имя>.webp — для компьютера, art/web/512/<имя>.webp — для телефона (он качает только свои);
//   для реалистичных текстур (config.js → REALISTIC) — ещё и заранее посчитанные карты, которые раньше браузер
//   считал при каждом запуске: <имя>_n (рельеф), <имя>_r (шероховатость), <имя>_ao (затенение во впадинах).
// Небо (sky-*) — одного размера для всех: оно на весь экран, уменьшать его заметно.
// Картинки интерфейса (ui-*) — в art/web/ui/, одного размера для всех: пустые прозрачные поля обрезаются,
//   длинная сторона — UI_SIZES (они на экране небольшие). Сюда же — обложки стартового экрана (cover — широкая, cover-tall — для телефона стоя) и логотип (logo).
// Пиксельные спрайты (PNG) не трогаем — им нужна каждая точка.
import { readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { REALISTIC } from '../src/config.js';

const ART = path.resolve('art');
const WEB = path.join(ART, 'web');
const SIZES = [1024, 512];   // размеры текстур: для компьютера и для телефона
const SKY_SIZE = 1024;       // небо — одно на всех
const UI_SIZES = { 'ui-paper': 512, 'ui-card': 512, 'ui-vine': 384, 'ui-flourish': 384, 'ui-divider': 768, 'cover-tall': 1536, cover: 1536, logo: 640 };
const QUALITY = 72;          // качество WebP для картинок (0–100): ниже — легче файл, но мельче детали
const MAP_QUALITY = 80;      // для карт рельефа: сжатие на них видно меньше, чем кажется

// Рельеф и шероховатость из самой картинки — так же, как раньше считал браузер (art/assets.js):
// яркость = высота (светлое выступает, тёмное в щелях), лёгкое размытие, наклон по соседям
async function reliefMaps(file, size, strength) {
  const { data } = await sharp(file).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const wrap = (v) => (v + size) % size;
  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) lum[i] = (data[i * 3] * 0.3 + data[i * 3 + 1] * 0.59 + data[i * 3 + 2] * 0.11) / 255;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += lum[wrap(y + dy) * size + wrap(x + dx)];
      height[y * size + x] = sum / 9;
    }
  }
  const h = (x, y) => height[wrap(y) * size + wrap(x)];
  const normal = Buffer.alloc(size * size * 3);
  const rough = Buffer.alloc(size * size);
  const ao = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = y * size + x;
      normal[i * 3] = (-dx / len * 0.5 + 0.5) * 255;
      normal[i * 3 + 1] = (dy / len * 0.5 + 0.5) * 255;
      normal[i * 3 + 2] = (1 / len * 0.5 + 0.5) * 255;
      rough[i] = (0.95 - height[i] * 0.25) * 255;      // выступы чуть глаже впадин
      ao[i] = Math.min(1, 0.45 + height[i] * 0.75) * 255; // впадины получают меньше света неба
    }
  }
  return { normal, rough, ao };
}

// Обрезать прозрачные поля: рамка по точкам, которые заметно видно (почти прозрачная «пыль» не считается)
async function trimAlpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [left, top, right, bottom] = [info.width, info.height, -1, -1];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return sharp(file).toBuffer();
  return sharp(file).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).toBuffer();
}

const save = (pixels, size, channels, file, quality) =>
  sharp(pixels, { raw: { width: size, height: size, channels } }).webp({ quality }).toFile(file);

const files = (await readdir(ART)).filter((f) => /\.(jpe?g|webp)$/i.test(f));
await rm(WEB, { recursive: true, force: true });
for (const size of SIZES) await mkdir(path.join(WEB, String(size)), { recursive: true });
await mkdir(path.join(WEB, 'ui'), { recursive: true });

let count = 0;
for (const file of await readdir(ART)) {
  const name = file.replace(/\.[^.]+$/, '');
  if (!UI_SIZES[name] || !/\.(png|jpe?g|webp)$/i.test(file)) continue;
  const side = UI_SIZES[name];
  // бумага — бесшовная, её не обрезаем; у остальных — убрать прозрачные поля вокруг рисунка
  const trimmed = name === 'ui-paper' ? await sharp(path.join(ART, file)).toBuffer() : await trimAlpha(path.join(ART, file));
  await sharp(trimmed).resize(side, side, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90 }).toFile(path.join(WEB, 'ui', `${name}.webp`));
  count++;
  console.log(`готово: ${name}`);
}
for (const file of files) {
  const name = file.replace(/\.[^.]+$/, '');
  const source = path.join(ART, file);
  const sky = name.startsWith('sky');
  if (!sky && !REALISTIC[name]) continue; // не текстура мира — оставляем как есть
  if (name === 'sky' && files.some((f) => f.startsWith('sky-evening'))) continue; // запасное небо — есть своё вечернее
  for (const size of SIZES) {
    const out = (suffix) => path.join(WEB, String(size), `${name}${suffix}.webp`);
    const side = sky ? SKY_SIZE : size;
    await sharp(source).resize(side, side).webp({ quality: QUALITY }).toFile(out(''));
    if (!sky) {
      const mapSize = Math.min(512, size / 2); // рабочий размер карт — как раньше в браузере
      const { normal, rough, ao } = await reliefMaps(source, mapSize, REALISTIC[name].relief);
      await save(normal, mapSize, 3, out('_n'), MAP_QUALITY);
      await save(rough, mapSize, 1, out('_r'), MAP_QUALITY);
      await save(ao, mapSize, 1, out('_ao'), MAP_QUALITY);
    }
  }
  count++;
  console.log(`готово: ${name}`);
}
console.log(`\nКартинок обработано: ${count}. Лежат в art/web/ — игра берёт их оттуда.`);
