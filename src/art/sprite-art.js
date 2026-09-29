// Пиксельные спрайты, нарисованные кодом: герой (енот и крот), растения, урожай в лапах, трава и цветы.
// Любой лист можно заменить своим рисунком из Aseprite — порядок кадров описан в ART.md.
import { COLORS, PLANTS } from '../config.js';
import { PixelSheet } from './pixels.js';

export const PLANT_ORDER = Object.keys(PLANTS); // строки листа растений

// ---------- Герой: енот и крот ----------
// Кадр 32×32, земля — нижняя строка. Колонки: стоит 0–3, идёт 4–9, действует 10–13, несёт 14–19.
// Строки: 0 — к зрителю, 1 — влево, 2 — вправо (зеркало), 3 — от зрителя.
// Все скины рисуются по одной схеме (одежда общая), отличаются окрасом, ушами, мордочкой и хвостом.
export const HERO = {
  frameW: 32, frameH: 32, cols: 20, rows: 4,
  anims: { idle: [0, 4], walk: [4, 6], act: [10, 4], carry: [14, 6] }, // [первый кадр, сколько кадров]
  dirs: { down: 0, left: 1, right: 2, up: 3 },
};

const C = COLORS;

// Окрас скинов. ears / mask / tail — есть ли уши, маска вокруг глаз, полосатый хвост
const SKINS = {
  mole: {
    body: C.moleBody, snout: C.moleSnout, nose: C.moleNose, eyes: C.moleEyes, paws: C.molePaws,
  },
  raccoon: {
    body: C.raccoonBody, snout: C.raccoonLight, nose: C.raccoonNose, eyes: C.raccoonEyes, paws: C.raccoonDark,
    dark: C.raccoonDark, light: C.raccoonLight, ears: true, mask: true, tail: true,
  },
};
export const HERO_SKINS = Object.keys(SKINS);

// Полосатый хвост: полосы по 2 пикселя, тёмная — через одну, кончик тёмный.
// Со спины — свисает вниз, в профиль — торчит назад; sway — покачивание (−1…1)
function tailBack(d, S, b, sway) {
  for (let y = 20; y <= 29; y++) {
    const t = (y - 20) / 9;
    const cx = 16 + Math.round(sway * t * 1.5);
    const w = y === 20 || y === 29 ? 1 : 2;
    d.rect(cx - w, y + (y === 29 ? 0 : b), w * 2 + 1, 1, y >= 28 || ((y - 20) >> 1) % 2 ? S.dark : S.body);
  }
}

function tailSide(d, S, b, sway) {
  for (let x = 21; x <= 29; x++) {
    const t = (x - 21) / 8;
    const cy = 23 - Math.round(t * t * 3) + Math.round(sway * t) + b;
    const h = x === 29 ? 1 : 2;
    d.rect(x, cy - h, 1, h * 2 + 1, x >= 28 || ((x - 21) >> 1) % 2 ? S.dark : S.body);
  }
}

// Ушко: тёмное снаружи, светлое внутри (со спины — без светлого)
function ear(d, S, x, y, back) {
  d.ellipse(x, y, 1.5, 1.5, S.dark);
  if (!back) d.px(x, y, S.light);
}

function hat(d, b, w) {
  d.ellipse(16, 6 + b, w === 9 ? 9 : 8, 1.5, C.hat);
  d.rect(12, 1 + b, w, 5, C.hat);
  d.rect(12, 4 + b, w, 1, C.hatBand);
}

// pose: bob — присесть (0–2), liftL/liftR — поднять ногу, footL/footR — шаг вбок (для профиля),
// arms — 'down' | 'forward' | 'carry', swingL/swingR — взмах рук, tail — покачивание хвоста
function drawHeroFront(d, pose, back, S) {
  const b = pose.bob;
  // ноги и лапки
  d.rect(12, 26 + b, 3, 4 - b - pose.liftL, S.body);
  d.rect(17, 26 + b, 3, 4 - b - pose.liftR, S.body);
  d.ellipse(13, 30 - pose.liftL, 2, 1, S.paws);
  d.ellipse(19, 30 - pose.liftR, 2, 1, S.paws);
  // грудка и комбинезон
  d.ellipse(16, 17 + b, 5, 3, S.body);
  d.ellipse(16, 22 + b, 6, 5, C.overalls);
  if (back) {
    d.line(12, 16 + b, 19, 20 + b, C.overalls); // лямки крест-накрест
    d.line(20, 16 + b, 13, 20 + b, C.overalls);
  } else {
    d.line(13, 16 + b, 13, 19 + b, C.overalls);
    d.line(19, 16 + b, 19, 19 + b, C.overalls);
    d.px(13, 19 + b, C.hatBand);
    d.px(19, 19 + b, C.hatBand);
  }
  // со спины хвост — поверх комбинезона, свисает к земле и покачивается
  // (спереди хвост не рисуем: за телом он читается как лишняя лапа)
  if (S.tail && back) tailBack(d, S, b, pose.tail);
  // руки
  const arm = (side) => {
    const x = side < 0 ? 9 : 23;
    const swing = side < 0 ? pose.swingL : pose.swingR;
    if (pose.arms === 'forward') {
      d.rect(side < 0 ? 10 : 21, 18 + b, 2, 4, S.body);
      d.ellipse(side < 0 ? 12 : 20, 24 + b, 2, 1.5, S.paws);
    } else if (pose.arms === 'carry' && !back) {
      d.rect(side < 0 ? 10 : 21, 17 + b, 2, 3, S.body);
      d.ellipse(side < 0 ? 12 : 20, 19 + b, 2, 1.5, S.paws);
    } else {
      d.rect(x, 17 + b, 2, 4, S.body);
      d.ellipse(x + (side < 0 ? 0 : 1), 21 + b + swing, 1.5, 1.5, S.paws);
    }
  };
  arm(-1);
  arm(1);
  // уши — по бокам шляпы
  if (S.ears) {
    ear(d, S, 10, 3 + b, back);
    ear(d, S, 22, 3 + b, back);
  }
  // голова
  d.ellipse(16, 10 + b, 6, 5, S.body);
  if (!back) {
    if (S.mask) {
      d.ellipse(11.5, 12 + b, 1.5, 1, S.light); // щёки
      d.ellipse(20.5, 12 + b, 1.5, 1, S.light);
      d.ellipse(13, 10 + b, 2.5, 1.2, S.dark);  // маска
      d.ellipse(19, 10 + b, 2.5, 1.2, S.dark);
      d.px(13, 8 + b, S.light);                  // светлые брови
      d.px(19, 8 + b, S.light);
    }
    d.ellipse(16, 13 + b, S.mask ? 3 : 2.5, 1.5, S.snout);
    d.rect(15, 12 + b, 2, 1, S.nose);
    d.px(13, 10 + b, S.eyes);
    d.px(19, 10 + b, S.eyes);
    if (S.mask) {
      d.px(14, 9 + b, S.light); // блик в глазах, чтобы не терялись в маске
      d.px(20, 9 + b, S.light);
    }
  }
  hat(d, b, 9);
}

// Профиль, мордочка влево (вправо — зеркально)
function drawHeroSide(d, pose, S) {
  const b = pose.bob;
  // хвост — сзади, покачивается при ходьбе
  if (S.tail) tailSide(d, S, b, pose.tail);
  d.rect(12 + pose.footL, 26 + b, 3, 4 - b - pose.liftL, S.body);
  d.rect(17 + pose.footR, 26 + b, 3, 4 - b - pose.liftR, S.body);
  d.ellipse(12 + pose.footL, 30 - pose.liftL, 2.5, 1, S.paws);
  d.ellipse(17 + pose.footR, 30 - pose.liftR, 2.5, 1, S.paws);
  d.ellipse(17, 17 + b, 5, 3, S.body);
  d.ellipse(17, 22 + b, 5.5, 5, C.overalls);
  d.line(15, 16 + b, 15, 19 + b, C.overalls);
  // ближняя рука
  if (pose.arms === 'forward') {
    d.rect(12, 18 + b, 3, 2, S.body);
    d.ellipse(10, 23 + b, 2, 1.5, S.paws);
  } else if (pose.arms === 'carry') {
    d.rect(12, 17 + b, 3, 2, S.body);
    d.ellipse(10, 19 + b, 2, 1.5, S.paws);
  } else {
    d.rect(15, 18 + b, 2, 4, S.body);
    d.ellipse(15 + pose.swingL, 22 + b, 1.5, 1.5, S.paws);
  }
  if (S.ears) ear(d, S, 20, 3 + b, false); // ухо на затылке, из-за шляпы
  d.ellipse(16, 10 + b, 5.5, 5, S.body);
  if (S.mask) {
    // енот: короткая острая мордочка, маска, светлая щека
    d.ellipse(15.5, 13 + b, 1.5, 1, S.light);
    d.ellipse(11, 12 + b, 3, 1.5, S.snout);
    d.ellipse(13, 10 + b, 2.5, 1.2, S.dark);
    d.px(13, 8 + b, S.light);
    d.rect(7, 11 + b, 2, 2, S.nose);
    d.px(12, 10 + b, S.eyes);
    d.px(13, 9 + b, S.light);
  } else {
    // крот: длинная мордочка с розовым носом
    d.ellipse(10, 12 + b, 3.5, 1.5, S.snout);
    d.rect(6, 11 + b, 2, 2, S.nose);
    d.px(13, 9 + b, S.eyes);
  }
  hat(d, b, 8);
}

function heroPose(anim, i) {
  const base = { bob: 0, liftL: 0, liftR: 0, footL: 0, footR: 0, swingL: 0, swingR: 0, arms: 'down', tail: 0 };
  if (anim === 'idle') return { ...base, bob: [0, 0, 1, 0][i], tail: [0, 0, 0, 1][i] }; // дыхание, хвост шевелится
  if (anim === 'act') return { ...base, bob: [0, 1, 2, 1][i], arms: 'forward', tail: [0, -1, -1, 0][i] };
  // ходьба и «несёт»: 6 кадров шага
  const p = (i / 6) * Math.PI * 2;
  const s = Math.sin(p);
  return {
    ...base,
    bob: i % 3 === 0 ? 1 : 0,
    liftL: s > 0.3 ? 1 : 0,
    liftR: s < -0.3 ? 1 : 0,
    footL: Math.round(Math.cos(p) * 2),
    footR: -Math.round(Math.cos(p) * 2),
    swingL: s > 0.3 ? -1 : s < -0.3 ? 1 : 0,
    swingR: s > 0.3 ? 1 : s < -0.3 ? -1 : 0,
    arms: anim === 'carry' ? 'carry' : 'down',
    tail: Math.round(Math.cos(p)),
  };
}

// Лист кадров героя для скина: 'raccoon' или 'mole'
export function drawHeroSheet(skin) {
  const S = SKINS[skin];
  const sheet = new PixelSheet(HERO.frameW * HERO.cols, HERO.frameH * HERO.rows);
  for (const [anim, [start, count]] of Object.entries(HERO.anims)) {
    for (let i = 0; i < count; i++) {
      const pose = heroPose(anim, i);
      const col = start + i;
      drawHeroFront(sheet.frame(col, HERO.dirs.down, 32, 32), pose, false, S);
      drawHeroSide(sheet.frame(col, HERO.dirs.left, 32, 32), pose, S);
      drawHeroSide(sheet.frame(col, HERO.dirs.right, 32, 32, true), pose, S);
      drawHeroFront(sheet.frame(col, HERO.dirs.up, 32, 32), pose, true, S);
    }
  }
  return sheet.finish();
}

// ---------- Растения ----------
// Кадр 32×40, земля — нижняя строка. Колонки: стадия 0 семечко, 1 росток, 2 куст, 3 спелое.
// Строки — растения в порядке PLANT_ORDER (морковь, редис, тыква, подсолнух, гриб).
export const PLANT_FRAME = { frameW: 32, frameH: 40, cols: 4 };

// Маленькая кучка земли у основания растения
function mound(d) {
  d.ellipse(16, 37, 4.5, 1.8, C.mound);
  d.px(14, 37, C.soil);
  d.px(18, 36, C.soil);
}

function sprout(d) {
  d.line(16, 31, 16, 35, C.leaves);
  d.ellipse(14, 31, 2, 1, C.leaves);
  d.ellipse(18, 30, 2, 1, C.leaves);
}

const DRAW_PLANT = {
  carrot(d, stage) {
    const top = stage === 3 ? 17 : 23;
    for (const [x, y] of [[9, top + 3], [12, top], [16, top - 1], [20, top], [23, top + 3]]) {
      d.line(16, 34, x, y, C.leaves);
      d.ellipse(x, y, 1.5, 1.5, C.leaves);
    }
    if (stage === 3) d.ellipse(16, 35, 4, 2, C.carrot); // оранжевые «плечики» морковки
  },
  radish(d, stage) {
    const y = stage === 3 ? 25 : 29;
    d.line(16, 34, 13, y, C.leaves);
    d.line(16, 34, 19, y, C.leaves);
    d.ellipse(13, y, 3, 4, C.leaves);
    d.ellipse(19, y, 3, 4, C.leaves);
    if (stage === 3) {
      d.ellipse(16, 33, 5, 4, C.radish);
      d.px(16, 37, '#f4e8e8');
    }
  },
  pumpkin(d, stage) {
    d.ellipse(10, 32, 4, 2.5, C.leaves);
    d.ellipse(22, 31, 4, 2.5, C.leaves);
    d.ellipse(16, 29, 3, 2, C.leaves);
    if (stage === 3) {
      d.ellipse(16, 31, 10, 6, C.pumpkin);
      for (const x of [11, 16, 21]) d.line(x, 27, x, 36, '#c86a14'); // рёбра тыквы
      d.rect(15, 23, 2, 3, C.stem);
    }
  },
  sunflower(d, stage) {
    const top = stage === 3 ? 12 : 16;
    d.line(16, 36, 16, top, C.leaves);
    d.ellipse(13, 27, 3, 1.5, C.leaves);
    d.ellipse(19, 22, 3, 1.5, C.leaves);
    if (stage === 3) {
      d.ellipse(16, 9, 7, 7, C.sunflowerPetals);
      d.ellipse(16, 9, 3.5, 3.5, C.sunflowerCenter);
      d.px(15, 8, '#6a4020');
      d.px(17, 10, '#6a4020');
    } else {
      d.ellipse(16, 15, 2, 2, C.leaves); // бутон
    }
  },
  mushroom(d, stage) {
    const glow = true;
    if (stage === 1) { d.ellipse(16, 34, 2, 1.5, C.mushroomCap, glow); return; }
    const [sx, sw, sy, sh, cy, rx, ry] = stage === 2 ? [15, 2, 31, 4, 30, 4, 2.5] : [14, 4, 28, 8, 26, 9, 5];
    d.ellipse(16, cy, rx, ry, C.mushroomCap, glow);
    for (let y = cy + 1; y <= cy + ry + 1; y++) for (let x = 16 - rx - 1; x <= 16 + rx + 1; x++) d.px(x, y, null); // низ шляпки срезан
    d.rect(sx, sy, sw, sh, C.mushroomStem);
    if (stage === 3) for (const [x, y] of [[12, 24], [17, 23], [20, 25]]) d.px(x, y, '#d8fbff', glow); // пятнышки
  },
};

export function drawPlantSheet() {
  const { frameW, frameH, cols } = PLANT_FRAME;
  const sheet = new PixelSheet(frameW * cols, frameH * PLANT_ORDER.length);
  PLANT_ORDER.forEach((type, row) => {
    for (let stage = 0; stage < cols; stage++) {
      const d = sheet.frame(stage, row, frameW, frameH);
      mound(d);
      if (stage === 0) { d.px(14, 35, C.seed); d.px(17, 36, C.seed); }
      else if (stage === 1 && type !== 'mushroom') sprout(d);
      else DRAW_PLANT[type](d, stage);
    }
  });
  return sheet.finish();
}

// ---------- Урожай в лапах ----------
// Кадр 16×16, колонки — растения в порядке PLANT_ORDER.
export const HELD_FRAME = { frameW: 16, frameH: 16 };

const DRAW_HELD = {
  carrot(d) { d.line(3, 11, 11, 5, C.carrot); d.line(3, 12, 11, 6, C.carrot); d.line(4, 12, 12, 6, C.carrot); d.line(12, 5, 14, 2, C.leaves); d.line(12, 6, 15, 5, C.leaves); },
  radish(d) { d.ellipse(8, 10, 4, 3.5, C.radish); d.line(8, 6, 6, 2, C.leaves); d.line(8, 6, 10, 2, C.leaves); },
  pumpkin(d) { d.ellipse(8, 9, 7, 5, C.pumpkin); d.line(5, 5, 5, 13, '#c86a14'); d.line(11, 5, 11, 13, '#c86a14'); d.rect(7, 2, 2, 3, C.stem); },
  sunflower(d) { d.line(8, 15, 8, 9, C.leaves); d.ellipse(8, 6, 5, 5, C.sunflowerPetals); d.ellipse(8, 6, 2.5, 2.5, C.sunflowerCenter); },
  mushroom(d) { d.ellipse(8, 8, 6, 3.5, C.mushroomCap, true); for (let x = 1; x < 15; x++) for (let y = 9; y < 12; y++) d.px(x, y, null); d.rect(6, 9, 4, 5, C.mushroomStem); },
};

export function drawHeldSheet() {
  const sheet = new PixelSheet(HELD_FRAME.frameW * PLANT_ORDER.length, HELD_FRAME.frameH);
  PLANT_ORDER.forEach((type, col) => DRAW_HELD[type](sheet.frame(col, 0, 16, 16)));
  return sheet.finish();
}

// ---------- Дым из трубы ----------
// Кадр 16×16, колонки 0–3: маленький плотный клуб → большой рассыпающийся (с «дырками»).
export const SMOKE_FRAME = { frameW: 16, frameH: 16, cols: 4 };

export function drawSmokeSheet() {
  const sheet = new PixelSheet(SMOKE_FRAME.frameW * SMOKE_FRAME.cols, SMOKE_FRAME.frameH);
  const puffs = [
    [[8, 9, 3, 3]],
    [[7, 9, 4, 3.5], [10, 7, 3, 3]],
    [[6, 9, 4.5, 4], [10, 7, 4, 3.5], [8, 5, 3, 2.5]],
    [[6, 9, 5, 4], [11, 7, 4, 4], [8, 4, 3.5, 3]],
  ];
  puffs.forEach((blobs, col) => {
    const d = sheet.frame(col, 0, 16, 16);
    blobs.forEach(([x, y, rx, ry]) => d.ellipse(x, y, rx, ry, C.smoke));
    if (col === 3) { // рассеивается: выбиваем пиксели шахматкой
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0 && (x * 7 + y * 3) % 5 < 3) d.px(x, y, null);
    }
  });
  return sheet.finish();
}

// ---------- Трава и цветы ----------
// Кадр 16×24, земля — нижняя строка. Колонки: пучки травы 0–2, цветы 3–5, высокая трава 6–7.
export const DECOR_FRAME = { frameW: 16, frameH: 24, cols: 8, tufts: [0, 1, 2], flowers: [3, 4, 5], tall: [6, 7] };

export function drawDecorSheet() {
  const { frameW, frameH, cols } = DECOR_FRAME;
  const sheet = new PixelSheet(frameW * cols, frameH);
  const grassTones = [[C.grass, '#6f8a30'], [C.tallGrass, '#9a8a3a'], [C.grass, C.tallGrass]];
  grassTones.forEach(([a, b], col) => {
    const d = sheet.frame(col, 0, frameW, frameH);
    [[3, 16, a], [6, 13, b], [8, 11, a], [10, 14, b], [13, 17, a]].forEach(([x, y, c]) => d.line(8, 23, x, y, c));
  });
  [['#e85a8a', C.flowerCenter], ['#f4efe6', C.flowerCenter], ['#f5c542', '#b0602a']].forEach(([petal, center], i) => {
    const d = sheet.frame(3 + i, 0, frameW, frameH);
    d.line(8, 23, 8, 12, C.leaves);
    d.ellipse(6, 18, 2, 1, C.leaves);
    d.ellipse(8, 10, 3, 3, petal);
    d.px(8, 10, center);
  });
  [[C.tallGrass, '#8a7a36'], ['#a88a3e', C.tallGrass]].forEach(([a, b], i) => {
    const d = sheet.frame(6 + i, 0, frameW, frameH);
    [[1, 6, a], [4, 2, b], [7, 1, a], [9, 3, b], [12, 2, a], [15, 7, b], [5, 8, b], [11, 9, a]].forEach(([x, y, c]) => d.line(8, 23, x, y, c));
  });
  return sheet.finish();
}

// ---------- Духи ----------
// Кадр 32×32. Строки: 0 — призрак, 1 — скелет, 2 — блуждающий огонь, 3 — монета (кадр 0; дух несёт её из корзинки).
// Колонки: движется 0–3, копается 4–7, несёт 8–11. Все смотрят на зрителя; влево-вправо — зеркалом.
// Светящиеся пиксели (последний аргумент true) подхватывает свечение — ночью духи сияют.
export const SPIRIT = {
  frameW: 32, frameH: 32, cols: 12, rows: 4,
  anims: { move: [0, 4], act: [4, 4], carry: [8, 4] },
  rows_: { ghost: 0, skeleton: 1, wisp: 2, coin: 3 },
};

// Призрак: круглая голова, волнистый подол, румянец. Весь светится мягко.
function drawGhost(d, anim, i) {
  const b = [0, 1, 2, 1][i];               // покачивается
  const wave = i % 2;                       // подол колышется
  const y = 6 + b;
  d.ellipse(16, y + 7, 8, 7, C.ghost, true);
  d.rect(8, y + 7, 17, 9, C.ghost, true);
  for (let x = 8; x <= 24; x++) {           // волнистый подол
    const down = ((x + wave * 2) % 4) < 2 ? 1 : 0;
    d.rect(x, y + 16, 1, 1 + down, C.ghostShade, true);
  }
  d.rect(9, y + 13, 15, 3, C.ghostShade, true); // тень к низу
  d.rect(9, y + 7, 15, 6, C.ghost, true);
  // ручки
  const armY = anim === 'carry' ? y + 9 : anim === 'act' ? y + 12 + (i % 2) : y + 10;
  d.ellipse(anim === 'carry' ? 10 : 7, armY, 1.5, 1.5, C.ghostShade, true);
  d.ellipse(anim === 'carry' ? 22 : 25, armY, 1.5, 1.5, C.ghostShade, true);
  // лицо
  d.rect(12, y + 6, 2, 2, C.spiritEyes);
  d.rect(19, y + 6, 2, 2, C.spiritEyes);
  d.px(12, y + 6, C.ghost);                  // блик в глазах
  d.px(19, y + 6, C.ghost);
  d.rect(10, y + 9, 2, 1, C.ghostCheeks);
  d.rect(21, y + 9, 2, 1, C.ghostCheeks);
  if (anim === 'act') d.rect(15, y + 9, 2, 2, C.spiritEyes); // «о!» — нашёл
  else d.rect(15, y + 10, 2, 1, C.spiritEyes);
}

// Скелет: большой череп, светящиеся глазницы, мелкий шаг; кости слегка светятся (ночью его видно)
function drawSkeleton(d, anim, i) {
  const step = anim === 'act' ? 0 : i % 2;
  const b = anim === 'act' ? [0, 1, 2, 1][i] : step;
  // ножки
  d.line(14, 25 + b, 14 - step, 30, C.bone, true);
  d.line(18, 25 + b, 18 + step, 30, C.bone, true);
  d.rect(13 - step, 30, 2, 1, C.boneShade);
  d.rect(18 + step, 30, 2, 1, C.boneShade);
  // тазик, позвоночник, рёбрышки
  d.rect(13, 23 + b, 7, 2, C.bone, true);
  d.line(16, 17 + b, 16, 23 + b, C.boneShade);
  d.line(13, 18 + b, 19, 18 + b, C.bone, true);
  d.line(13, 20 + b, 19, 20 + b, C.bone, true);
  // ручки
  if (anim === 'carry') {
    d.line(12, 18 + b, 11, 15 + b, C.bone, true);
    d.line(20, 18 + b, 21, 15 + b, C.bone, true);
  } else if (anim === 'act') {
    d.line(12, 18 + b, 11, 23 + b + (i % 2), C.bone, true);
    d.line(20, 18 + b, 21, 23 + b + ((i + 1) % 2), C.bone, true);
  } else {
    d.line(12, 18 + b, 10 + step, 22 + b, C.bone, true);
    d.line(20, 18 + b, 22 - step, 22 + b, C.bone, true);
  }
  // черепушка
  d.ellipse(16, 10 + b, 7, 6, C.bone, true);
  d.rect(12, 15 + b, 9, 2, C.boneShade);     // челюсть
  d.px(14, 16 + b, C.bone, true);
  d.px(16, 16 + b, C.bone, true);
  d.px(18, 16 + b, C.bone, true);
  d.rect(12, 9 + b, 3, 3, C.spiritEyes);     // глазницы
  d.rect(18, 9 + b, 3, 3, C.spiritEyes);
  d.px(13, 10 + b, C.boneGlow, true);        // огоньки в глазницах
  d.px(19, 10 + b, C.boneGlow, true);
  d.px(16, 13 + b, C.spiritEyes);            // носик
}

// Блуждающий огонь: язык пламени с глазами, пляшет
function drawWisp(d, anim, i) {
  const b = [0, 1, 0, -1][i];
  const cy = 18 + (anim === 'act' ? [0, 1, 2, 1][i] : 0);
  d.ellipse(16, cy, 6, 6, C.wispFlame, true);
  // язычки сверху — каждый кадр разные
  const tips = [[13, 8, 16, 5, 19, 9], [12, 9, 16, 4, 20, 8], [13, 7, 17, 5, 19, 9], [12, 8, 15, 5, 19, 8]][i];
  for (let k = 0; k < 6; k += 2) d.line(16, cy - 3, tips[k] + b, tips[k + 1], C.wispTip, true);
  d.ellipse(16, cy - 3, 3, 3, C.wispFlame, true);
  d.ellipse(16, cy + 1, 3.5, 3.5, C.wispCore, true);
  d.px(14, cy, C.spiritEyes);                // глазки
  d.px(18, cy, C.spiritEyes);
  if (anim === 'carry') {                    // «ручки»-искорки держат добычу
    d.px(10, cy - 3, C.wispTip, true);
    d.px(22, cy - 3, C.wispTip, true);
  }
}

function drawCoin(d) {
  d.ellipse(16, 16, 4, 4, C.spiritCoin, true);
  d.rect(15, 14, 2, 5, '#b8862a');
}

export function drawSpiritSheet() {
  const sheet = new PixelSheet(SPIRIT.frameW * SPIRIT.cols, SPIRIT.frameH * SPIRIT.rows);
  const draw = { ghost: drawGhost, skeleton: drawSkeleton, wisp: drawWisp };
  for (const [kind, row] of Object.entries(SPIRIT.rows_)) {
    if (kind === 'coin') continue;
    for (const [anim, [start, count]] of Object.entries(SPIRIT.anims)) {
      for (let i = 0; i < count; i++) draw[kind](sheet.frame(start + i, row, 32, 32), anim, i);
    }
  }
  drawCoin(sheet.frame(0, SPIRIT.rows_.coin, 32, 32));
  return sheet.finish();
}
