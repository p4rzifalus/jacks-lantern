// Цветокоррекция (LUT): таблицы «какой цвет превращается в какой».
// Строим их прямо в коде из простых правил: оттенок теней, оттенок светов, насыщенность, контраст.
// Потом их можно заменить на .cube-файлы, сделанные в Photoshop или DaVinci.
import { LookupTexture } from 'postprocessing';

const SIZE = 32;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const luma = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;

// shadows / highlights — цвет, в который тонируются тени и света; amount — сила
function grade({ shadows, highlights, shadowAmount, highlightAmount, saturation, contrast, lift = 0 }) {
  return (r, g, b) => {
    // мягкая S-кривая контраста вокруг середины
    const curve = (v) => clamp01(0.5 + (v - 0.5) * contrast + lift * (1 - v));
    r = curve(r); g = curve(g); b = curve(b);

    const l = luma(r, g, b);
    // насыщенность
    r = lerp(l, r, saturation); g = lerp(l, g, saturation); b = lerp(l, b, saturation);

    // раздельное тонирование: тени и света в разные оттенки
    const ws = (1 - l) ** 2 * shadowAmount;
    const wh = l ** 2 * highlightAmount;
    r = lerp(r, r * shadows[0] * 2, ws); g = lerp(g, g * shadows[1] * 2, ws); b = lerp(b, b * shadows[2] * 2, ws);
    r = lerp(r, r * highlights[0] * 2, wh); g = lerp(g, g * highlights[1] * 2, wh); b = lerp(b, b * highlights[2] * 2, wh);
    return [clamp01(r), clamp01(g), clamp01(b)];
  };
}

function buildLUT(name, fn) {
  const data = new Float32Array(SIZE ** 3 * 4);
  const s = 1 / (SIZE - 1);
  for (let bi = 0; bi < SIZE; bi++) {
    for (let gi = 0; gi < SIZE; gi++) {
      for (let ri = 0; ri < SIZE; ri++) {
        const i = (ri + gi * SIZE + bi * SIZE * SIZE) * 4;
        const [r, g, b] = fn(ri * s, gi * s, bi * s);
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
      }
    }
  }
  const lut = new LookupTexture(data, SIZE);
  lut.name = name;
  return lut;
}

export function createLUTs() {
  return {
    // Утро: розово-золотые света, мягкие сиреневые тени, воздух чуть светлее
    morning: buildLUT('morning', grade({
      shadows: [0.5, 0.46, 0.6], shadowAmount: 0.35,
      highlights: [0.66, 0.52, 0.44], highlightAmount: 0.38,
      saturation: 1.18, contrast: 1.06, lift: 0.03,
    })),
    // День: золотой осенний свет — тёплые янтарные света, мягкие тёплые тени, сочный цвет
    day: buildLUT('day', grade({
      shadows: [0.52, 0.46, 0.5], shadowAmount: 0.25,
      highlights: [0.64, 0.53, 0.4], highlightAmount: 0.32,
      saturation: 1.2, contrast: 1.12, lift: 0.01,
    })),
    // Вечер: под наше небо — тени в сиреневый, света в янтарный, чуть приглушённый цвет
    evening: buildLUT('evening', grade({
      shadows: [0.5, 0.45, 0.62], shadowAmount: 0.45,
      highlights: [0.64, 0.53, 0.4], highlightAmount: 0.35,
      saturation: 1.05, contrast: 1.06, lift: 0.03,
    })),
    // Осень: тёплые золотые света, чуть сиреневые тени, сочнее цвет
    autumn: buildLUT('autumn', grade({
      shadows: [0.46, 0.44, 0.58], shadowAmount: 0.35,
      highlights: [0.6, 0.52, 0.4], highlightAmount: 0.35,
      saturation: 1.15, contrast: 1.08, lift: 0.02,
    })),
    // Закат: сильнее в оранжево-розовое, приподнятые фиолетовые тени
    sunset: buildLUT('sunset', grade({
      shadows: [0.52, 0.4, 0.62], shadowAmount: 0.5,
      highlights: [0.66, 0.5, 0.38], highlightAmount: 0.5,
      saturation: 1.2, contrast: 1.1, lift: 0.04,
    })),
    // Сумерки: холодные синие тени, приглушённый цвет (пригодится для ночи)
    dusk: buildLUT('dusk', grade({
      shadows: [0.38, 0.44, 0.66], shadowAmount: 0.55,
      highlights: [0.58, 0.52, 0.46], highlightAmount: 0.2,
      saturation: 0.85, contrast: 1.05, lift: 0.03,
    })),
    // Ночь: лунная синева в тенях, приглушённый цвет; тёплые фонари остаются тёплыми
    night: buildLUT('night', grade({
      shadows: [0.36, 0.42, 0.7], shadowAmount: 0.6,
      highlights: [0.6, 0.52, 0.44], highlightAmount: 0.15,
      saturation: 0.8, contrast: 1.08, lift: 0.02,
    })),
    neutral: LookupTexture.createNeutral(SIZE),
  };
}

// Смесь двух таблиц — для плавной смены времени суток: mix(a, b, t) — от a (t = 0) к b (t = 1)
export function createLUTBlend() {
  const data = new Float32Array(SIZE ** 3 * 4);
  const texture = new LookupTexture(data, SIZE);
  texture.name = 'auto';
  return {
    texture,
    mix(a, b, t) {
      const da = a.image.data;
      const db = b.image.data;
      for (let i = 0; i < data.length; i++) data[i] = da[i] + (db[i] - da[i]) * t;
      texture.needsUpdate = true;
    },
  };
}
