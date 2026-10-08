// Пиксельные спрайты, нарисованные кодом: герой (енот и крот), растения, урожай, инструменты в лапах, трава и цветы.
// Любой лист можно заменить своим рисунком из Aseprite — порядок кадров описан в ART.md.
import { COLORS, PLANTS } from '../config.js';
import { PixelSheet } from './pixels.js';

export const PLANT_ORDER = Object.keys(PLANTS); // строки листа растений

// Рисунок растения из таблицы рисунков: у гибрида без своего рисунка — рисунок первого родителя
function artOf(table, type) {
  let t = type;
  while (!table[t] && PLANTS[t]?.hybrid) t = PLANTS[t].hybrid[0];
  return table[t];
}
// Чей рисунок у растения (для гибрида без своего — родителя)
function artType(type) {
  let t = type;
  while (!DRAW_PLANT[t] && PLANTS[t]?.hybrid) t = PLANTS[t].hybrid[0];
  return t;
}

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
// Кадр 32×40, земля — нижняя строка. Колонки: стадии 0 семечко, 1 росток, 2 куст, 3 спелое;
// дальше — спелое растение ночью: 4–5 настороже (по улице ходит дух), 6 замах, 7 удар.
// Строки — растения в порядке PLANT_ORDER (морковь, редис, тыква, подсолнух, гриб, потом гибриды).
export const PLANT_FRAME = { frameW: 32, frameH: 40, cols: 8, alert: [4, 2], windup: 6, strike: 7 };

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

const FIRE = '#ffd27a';    // вспышка редиса, свет изнутри тыквы
const EMBER = '#ff8a4a';   // тлеющий редис

// pose: 'rest' — просто растёт; ночью у спелого: 'alert' (i — кадр 0/1), 'windup' — замах, 'strike' — удар
const DRAW_PLANT = {
  carrot(d, stage, pose = 'rest', i = 0) {
    let top = stage === 3 ? 17 : 23;
    let shift = 0;   // куда клонится ботва
    let spread = 1;  // насколько раскрыта
    if (pose === 'alert') { top = 15; shift = i ? 1 : -1; }
    if (pose === 'windup') { top = 20; shift = -5; spread = 0.6; }
    if (pose === 'strike') { top = 17; shift = 6; spread = 1.15; }
    for (const [dx, dy] of [[-7, 3], [-4, 0], [0, -1], [4, 0], [7, 3]]) {
      const x = Math.round(16 + dx * spread + shift);
      const y = top + dy;
      d.line(16, 34, x, y, C.leaves);
      d.ellipse(x, y, 1.5, 1.5, C.leaves);
    }
    if (pose === 'strike') { // одна ботвинка вытянулась хлыстом
      d.line(16, 33, 23, 26, C.leaves);
      d.line(23, 26, 28, 23, C.leaves);
      d.ellipse(28, 23, 1.5, 1, C.leaves);
    }
    if (stage === 3) d.ellipse(16, 35, 4, 2, C.carrot); // оранжевые «плечики» морковки
  },
  radish(d, stage, pose = 'rest', i = 0) {
    let y = stage === 3 ? 25 : 29;
    let [lx, rx] = [13, 19];
    let body = [16, 33, 5, 4];
    if (pose === 'alert') y = 24;
    if (pose === 'windup') { y = 27; [lx, rx] = [14, 18]; body = [16, 34, 6, 3]; }
    if (pose === 'strike') { y = 23; [lx, rx] = [11, 21]; body = [16, 32, 4.5, 4.5]; }
    d.line(16, 34, lx, y, C.leaves);
    d.line(16, 34, rx, y, C.leaves);
    d.ellipse(lx, y, 3, 4, C.leaves);
    d.ellipse(rx, y, 3, 4, C.leaves);
    if (stage !== 3) return;
    d.ellipse(...body, C.radish);
    d.px(16, 37, '#f4e8e8');
    if (pose === 'alert' || pose === 'windup') d.ellipse(16, body[1], 1.5 + i, 1.5, EMBER, true); // тлеет изнутри
    if (pose === 'strike') { // вспышка на верхушке: вылетает искра
      d.ellipse(16, 32, 2.5, 2.5, EMBER, true);
      d.ellipse(16, 17, 2, 2, FIRE, true);
      for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, -3]]) d.line(16, 17, 16 + dx, 17 + dy, EMBER, true);
    }
  },
  pumpkin(d, stage, pose = 'rest', i = 0) {
    d.ellipse(10, 32, 4, 2.5, C.leaves);
    d.ellipse(22, 31, 4, 2.5, C.leaves);
    d.ellipse(16, 29, 3, 2, C.leaves);
    if (stage !== 3) return;
    // [центр по высоте, полуширина, полувысота]: присела перед толчком, вытянулась при толчке
    const [cy, rx, ry] = pose === 'windup' ? [32, 11, 5] : pose === 'strike' ? [29, 9, 7] : [31, 10, 6];
    d.ellipse(16, cy, rx, ry, C.pumpkin);
    for (const x of [16 - rx / 2, 16, 16 + rx / 2]) d.line(x, cy - ry + 1, x, cy + ry - 1, '#c86a14'); // рёбра тыквы
    d.rect(15, cy - ry - 2, 2, 3, C.stem);
    if (pose === 'rest') return;
    // ночью внутри загорается свет, как у фонаря: глаза и улыбка
    const light = pose === 'alert' && i ? '#ffb040' : FIRE;
    const ey = cy - 2;
    for (const ex of [11, 19]) {
      d.rect(ex, ey, 3, 2, light, true);
      d.px(ex + (ex < 16 ? 2 : 0), ey - 1, light, true); // «бровки» домиком
    }
    const my = cy + 2;
    d.rect(12, my, 9, 1, light, true);
    for (const x of [13, 16, 19]) d.px(x, my + 1, light, true);
  },
  sunflower(d, stage, pose = 'rest', i = 0) {
    const top = stage === 3 ? 12 : 16;
    d.line(16, 36, 16, top, C.leaves);
    d.ellipse(13, 27, 3, 1.5, C.leaves);
    d.ellipse(19, 22, 3, 1.5, C.leaves);
    if (stage !== 3) { d.ellipse(16, 15, 2, 2, C.leaves); return; } // бутон
    if (pose === 'alert') { // повернул голову, всматривается
      const y = 9 + i;
      d.ellipse(17, y, 5, 7, C.sunflowerPetals);
      d.ellipse(19, y, 2, 3.5, C.sunflowerCenter);
      d.px(19, y - 1, '#6a4020');
      return;
    }
    if (pose === 'windup') { // голова чуть откинута, лепестки сжаты
      d.ellipse(15, 10, 6, 6, C.sunflowerPetals);
      d.ellipse(15, 10, 3, 3, C.sunflowerCenter);
      return;
    }
    if (pose === 'strike') { // раскрылся во всю ширину, серединка вспыхнула
      d.ellipse(16, 9, 8, 8, C.sunflowerPetals, true);
      for (const [dx, dy] of [[-9, 0], [9, 0], [0, -9], [-7, -7], [7, -7], [-7, 6], [7, 6]]) d.px(16 + dx, 9 + dy, C.sunflowerPetals, true);
      d.ellipse(16, 9, 4, 4, '#fff0a0', true);
      return;
    }
    d.ellipse(16, 9, 7, 7, C.sunflowerPetals);
    d.ellipse(16, 9, 3.5, 3.5, C.sunflowerCenter);
    d.px(15, 8, '#6a4020');
    d.px(17, 10, '#6a4020');
  },
  mushroom(d, stage, pose = 'rest', i = 0) {
    const glow = true;
    if (stage === 1) { d.ellipse(16, 34, 2, 1.5, C.mushroomCap, glow); return; }
    // [стебель x, ширина, верх, высота, шляпка y, полуширина, полувысота]
    let shape = stage === 2 ? [15, 2, 31, 4, 30, 4, 2.5] : [14, 4, 28, 8, 26, 9, 5];
    if (pose === 'windup') shape = [14, 4, 31, 5, 29, 10, 4];   // присел
    if (pose === 'strike') shape = [14, 4, 27, 9, 25, 9, 5];    // выпрямился, выпустил споры
    const [sx, sw, sy, sh, cy, rx, ry] = shape;
    d.ellipse(16, cy, rx, ry, pose === 'alert' && i ? '#a8f4ff' : C.mushroomCap, glow);
    for (let y = cy + 1; y <= cy + ry + 1; y++) for (let x = 16 - rx - 1; x <= 16 + rx + 1; x++) d.px(x, y, null); // низ шляпки срезан
    d.rect(sx, sy, sw, sh, C.mushroomStem);
    if (stage !== 3) return;
    const spots = pose === 'alert'
      ? [[12, cy - 2], [17, cy - 3], [20, cy - 1], [i ? 9 : 14, cy - 1], [i ? 22 : 15, cy - 4]]
      : [[12, cy - 2], [17, cy - 3], [20, cy - 1]];
    for (const [x, y] of spots) d.px(x, y, '#d8fbff', glow); // пятнышки
    if (pose === 'strike') for (const [x, y] of [[10, 17], [16, 14], [22, 17], [13, 12], [19, 11], [8, 13], [24, 12]]) d.px(x, y, '#b8f8ff', glow);
  },

  // ---------- Гибриды: похожи на обоих родителей ----------
  // Огнекорень (морковь + редис): ботва моркови с тлеющими кончиками, корень красный, как редис
  fireroot(d, stage, pose = 'rest', i = 0) {
    let top = stage === 3 ? 17 : 23;
    let shift = 0;
    let spread = 1;
    if (pose === 'alert') { top = 15; shift = i ? 1 : -1; }
    if (pose === 'windup') { top = 20; shift = -5; spread = 0.6; }
    if (pose === 'strike') { top = 17; shift = 6; spread = 1.15; }
    for (const [dx, dy] of [[-7, 3], [-4, 0], [0, -1], [4, 0], [7, 3]]) {
      const x = Math.round(16 + dx * spread + shift);
      const y = top + dy;
      d.line(16, 34, x, y, C.leaves);
      d.ellipse(x, y, 1.5, 1.5, C.leaves);
      if (stage === 3) d.px(x, y - 1, pose === 'alert' && i ? FIRE : EMBER, true); // кончики тлеют
    }
    if (pose === 'strike') { // горящий хлыст
      d.line(16, 33, 23, 26, C.leaves);
      d.line(23, 26, 28, 23, C.leaves);
      d.ellipse(28, 23, 2, 1.5, FIRE, true);
      d.px(30, 21, EMBER, true);
    }
    if (stage === 3) {
      d.ellipse(16, 35, 4, 2, C.firerootRoot);
      d.px(15, 34, EMBER, true);
    }
  },
  // Тыква-фонарь (редис + тыква): тыква поменьше с вырезанным лицом — светится всегда, сверху ботва редиса
  lanternPumpkin(d, stage, pose = 'rest', i = 0) {
    d.ellipse(10, 33, 3.5, 2, C.leaves);
    d.ellipse(22, 32, 3.5, 2, C.leaves);
    if (stage !== 3) {
      d.line(16, 34, 13, 28, C.leaves);
      d.line(16, 34, 19, 28, C.leaves);
      d.ellipse(13, 28, 2, 3, C.leaves);
      d.ellipse(19, 28, 2, 3, C.leaves);
      return;
    }
    const [cy, rx, ry] = pose === 'windup' ? [32, 9.5, 4.5] : pose === 'strike' ? [29, 7.5, 6] : [31, 8, 5];
    d.ellipse(16, cy, rx, ry, C.lanternPumpkin);
    for (const x of [16 - rx / 2, 16 + rx / 2]) d.line(x, cy - ry + 1, x, cy + ry - 1, '#8f2e1a'); // рёбра
    d.line(16, cy - ry, 13, cy - ry - 5, C.leaves); // ботва редиса вместо хвостика
    d.line(16, cy - ry, 19, cy - ry - 5, C.leaves);
    d.ellipse(13, cy - ry - 6, 2, 2.5, C.leaves);
    d.ellipse(19, cy - ry - 6, 2, 2.5, C.leaves);
    const light = pose === 'rest' || (pose === 'alert' && i) ? '#ffb040' : FIRE;
    d.rect(12, cy - 2, 2, 2, light, true); // глаза
    d.rect(18, cy - 2, 2, 2, light, true);
    d.rect(13, cy + 1, 6, 1, light, true); // улыбка
    d.px(14, cy + 2, light, true);
    d.px(17, cy + 2, light, true);
    if (pose === 'strike') for (const [x, y] of [[5, cy - 4], [27, cy - 5], [8, cy - 9], [24, cy - 10]]) d.px(x, y, FIRE, true); // искры
  },
  // Солнечная тыква (тыква + подсолнух): золотистая тыква с короной из лепестков
  sunPumpkin(d, stage, pose = 'rest', i = 0) {
    d.ellipse(10, 32, 4, 2.5, C.leaves);
    d.ellipse(22, 31, 4, 2.5, C.leaves);
    d.ellipse(16, 29, 3, 2, C.leaves);
    if (stage !== 3) return;
    const [cy, rx, ry] = pose === 'windup' ? [32, 11, 5] : pose === 'strike' ? [29, 9, 7] : [31, 10, 6];
    d.ellipse(16, cy, rx, ry, C.sunPumpkin);
    for (const x of [16 - rx / 2, 16, 16 + rx / 2]) d.line(x, cy - ry + 1, x, cy + ry - 1, '#d9a832');
    const top = cy - ry - 1;
    const open = pose === 'windup' ? 2 : pose === 'strike' ? 4 : 3; // лепестки сжаты / раскрыты
    for (const [dx, dy] of [[-1, 0], [1, 0], [-0.7, -0.7], [0.7, -0.7], [0, -1]]) {
      d.ellipse(16 + dx * open, top + dy * open, 1.5, 1.5, C.sunflowerPetals, pose === 'alert' && i);
    }
    d.ellipse(16, top, 1.5, 1.5, C.sunflowerCenter);
  },
  // Лунный гриб (подсолнух + гриб): серебристая шляпка с полумесяцем, под ней — бахрома из лепестков
  moonMushroom(d, stage, pose = 'rest', i = 0) {
    const glow = true;
    if (stage === 1) { d.ellipse(16, 34, 2, 1.5, C.moonCap, glow); return; }
    let shape = stage === 2 ? [15, 2, 31, 4, 30, 4, 2.5] : [14, 4, 28, 8, 26, 9, 5];
    if (pose === 'windup') shape = [14, 4, 31, 5, 29, 10, 4];
    if (pose === 'strike') shape = [14, 4, 27, 9, 25, 9, 5];
    const [sx, sw, sy, sh, cy, rx, ry] = shape;
    d.ellipse(16, cy, rx, ry, pose === 'alert' && i ? '#f0f2ff' : C.moonCap, glow);
    for (let y = cy + 1; y <= cy + ry + 1; y++) for (let x = 16 - rx - 1; x <= 16 + rx + 1; x++) d.px(x, y, null);
    d.rect(sx, sy, sw, sh, C.mushroomStem);
    if (stage !== 3) return;
    for (let x = 16 - rx + 1; x <= 16 + rx - 1; x += 3) d.px(x, cy + 1, C.sunflowerPetals); // бахрома
    d.ellipse(13, cy - 2, 2.5, 2.5, '#fff8d0', glow); // полумесяц: светлый круг, «надкушенный» шляпкой
    d.ellipse(14, cy - 3, 2, 2, pose === 'alert' && i ? '#f0f2ff' : C.moonCap, glow);
    if (pose === 'strike') for (let k = 0; k < 5; k++) d.line(16 + (k - 2) * 3, cy - ry - 2, 16 + (k - 2) * 5, cy - ry - 8, '#fff8d0', glow); // лучи
  },
  // Звездоцвет (огнекорень + лунный гриб): на тонком стебле — светящаяся пятиконечная звезда
  starbloom(d, stage, pose = 'rest', i = 0) {
    const top = stage === 3 ? 14 : 19;
    d.line(16, 36, 16, top, C.leaves);
    d.ellipse(13, 29, 3, 1.5, C.leaves);
    d.ellipse(19, 25, 3, 1.5, C.leaves);
    d.px(10, 29, EMBER, true); // кончики листьев тлеют, как у огнекорня
    d.px(22, 25, EMBER, true);
    if (stage !== 3) { d.ellipse(16, top - 1, 2, 2, C.starbloom, true); return; }
    const r = pose === 'windup' ? 5 : pose === 'strike' ? 9 : 7;
    const turn = pose === 'alert' ? (i ? 18 : -18) : 0; // всматривается — чуть поворачивается
    for (let k = 0; k < 5; k++) {
      const a = ((-90 + 72 * k + turn) * Math.PI) / 180;
      d.line(16, 9, 16 + Math.cos(a) * r, 9 + Math.sin(a) * r, C.starbloom, true);
    }
    d.ellipse(16, 9, 2.5, 2.5, '#fff6c8', true);
    if (pose === 'strike') for (const [x, y] of [[5, 6], [27, 6], [8, 19], [24, 19], [16, 0], [3, 13], [29, 13]]) d.px(x, y, '#b8f8ff', true);
  },
  // Золотая тыква (тыква-фонарь + солнечная тыква): большая, блестящая, с искорками
  goldPumpkin(d, stage, pose = 'rest', i = 0) {
    d.ellipse(9, 32, 4, 2.5, C.leaves);
    d.ellipse(23, 31, 4, 2.5, C.leaves);
    d.ellipse(16, 29, 3, 2, C.leaves);
    if (stage !== 3) return;
    const [cy, rx, ry] = pose === 'windup' ? [32, 12, 5] : pose === 'strike' ? [29, 10, 7.5] : [31, 11, 6.5];
    d.ellipse(16, cy, rx, ry, C.goldPumpkin);
    for (const x of [16 - rx / 2, 16, 16 + rx / 2]) d.line(x, cy - ry + 1, x, cy + ry - 1, '#c9961a');
    d.rect(15, cy - ry - 2, 2, 3, C.stem);
    for (let x = 16 - rx + 3; x <= 16 + rx - 3; x++) d.px(x, Math.round(cy - ry * Math.sqrt(1 - ((x - 16) / rx) ** 2)) + 1, '#fff2b0', true); // блестящий верх
    const sparkle = pose === 'alert' && i ? [[22, cy - 3], [10, cy + 1]] : [[11, cy - 3], [21, cy + 2]];
    for (const [x, y] of sparkle) { // блики-искорки
      d.px(x, y, '#fffbe0', true);
      d.px(x - 1, y, '#ffe680', true);
      d.px(x + 1, y, '#ffe680', true);
      d.px(x, y - 1, '#ffe680', true);
      d.px(x, y + 1, '#ffe680', true);
    }
  },
};

const NO_SPROUT = new Set(['mushroom', 'moonMushroom']); // грибы вместо ростка рисуют сами себя (маленькую шляпку)

export function drawPlantSheet() {
  const { frameW, frameH, cols } = PLANT_FRAME;
  const sheet = new PixelSheet(frameW * cols, frameH * PLANT_ORDER.length);
  // что в какой колонке: [стадия, поза, кадр]
  const columns = [[0], [1], [2], [3], [3, 'alert', 0], [3, 'alert', 1], [3, 'windup'], [3, 'strike']];
  PLANT_ORDER.forEach((type, row) => {
    columns.forEach(([stage, pose, i], col) => {
      const d = sheet.frame(col, row, frameW, frameH);
      mound(d);
      if (stage === 0) { d.px(14, 35, C.seed); d.px(17, 36, C.seed); }
      else if (stage === 1 && !NO_SPROUT.has(artType(type))) sprout(d);
      else artOf(DRAW_PLANT, type)(d, stage, pose, i);
    });
  });
  return sheet.finish();
}

// ---------- Эффекты боя ----------
// Кадр 16×16, 4 колонки. Строки: 0 — искра редиса (летит, мерцает), 1 — вспышка попадания (звёздочка раскрывается и гаснет).
export const FX = { frameW: 16, frameH: 16, cols: 4, rows_: { spark: 0, star: 1 } };

export function drawFxSheet() {
  const sheet = new PixelSheet(FX.frameW * FX.cols, FX.frameH * 2);
  for (let i = 0; i < 4; i++) {
    const d = sheet.frame(i, FX.rows_.spark, 16, 16);
    const r = [3, 3.5, 3, 2.5][i];
    d.ellipse(8, 8, r + 1, r + 1, EMBER, true);
    d.ellipse(8, 8, r - 0.5, r - 0.5, FIRE, true);
    d.px(8, 8, '#fff6d8', true);
    const [dx, dy] = [[5, -2], [-2, -5], [-5, 2], [2, 5]][i]; // искорка отлетает то в одну, то в другую сторону
    d.px(8 + dx, 8 + dy, FIRE, true);
  }
  for (let i = 0; i < 4; i++) {
    const d = sheet.frame(i, FX.rows_.star, 16, 16);
    const len = [2, 5, 7, 7][i];
    const c = i < 3 ? '#f4fbff' : '#a8d8ff';
    if (i < 3) d.ellipse(8, 8, [2, 1.5, 1][i], [2, 1.5, 1][i], c, true);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const from = i === 3 ? 4 : 1; // последний кадр — лучики оторвались от центра
      d.line(8 + dx * from, 8 + dy * from, 8 + dx * len, 8 + dy * len, c, true);
    }
    if (i >= 1) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) d.px(8 + dx * (i + 1), 8 + dy * (i + 1), c, true);
  }
  return sheet.finish();
}

// ---------- Урожай (в корзинке у енота и в лапах у духов) ----------
// Кадр 16×16, колонки — растения в порядке PLANT_ORDER.
export const HELD_FRAME = { frameW: 16, frameH: 16 };

const DRAW_HELD = {
  carrot(d) { d.line(3, 11, 11, 5, C.carrot); d.line(3, 12, 11, 6, C.carrot); d.line(4, 12, 12, 6, C.carrot); d.line(12, 5, 14, 2, C.leaves); d.line(12, 6, 15, 5, C.leaves); },
  radish(d) { d.ellipse(8, 10, 4, 3.5, C.radish); d.line(8, 6, 6, 2, C.leaves); d.line(8, 6, 10, 2, C.leaves); },
  pumpkin(d) { d.ellipse(8, 9, 7, 5, C.pumpkin); d.line(5, 5, 5, 13, '#c86a14'); d.line(11, 5, 11, 13, '#c86a14'); d.rect(7, 2, 2, 3, C.stem); },
  sunflower(d) { d.line(8, 15, 8, 9, C.leaves); d.ellipse(8, 6, 5, 5, C.sunflowerPetals); d.ellipse(8, 6, 2.5, 2.5, C.sunflowerCenter); },
  mushroom(d) { d.ellipse(8, 8, 6, 3.5, C.mushroomCap, true); for (let x = 1; x < 15; x++) for (let y = 9; y < 12; y++) d.px(x, y, null); d.rect(6, 9, 4, 5, C.mushroomStem); },
  fireroot(d) { d.line(3, 11, 11, 5, C.firerootRoot); d.line(3, 12, 11, 6, C.firerootRoot); d.line(4, 12, 12, 6, C.firerootRoot); d.line(12, 5, 14, 2, C.leaves); d.line(12, 6, 15, 5, C.leaves); d.px(14, 1, EMBER, true); d.px(15, 4, EMBER, true); },
  lanternPumpkin(d) {
    d.ellipse(8, 10, 6, 4.5, C.lanternPumpkin);
    d.line(8, 5, 6, 2, C.leaves); d.line(8, 5, 10, 2, C.leaves);
    d.rect(5, 9, 2, 1, '#ffb040', true); d.rect(10, 9, 2, 1, '#ffb040', true); d.rect(6, 12, 5, 1, '#ffb040', true);
  },
  sunPumpkin(d) {
    d.ellipse(8, 10, 7, 4.5, C.sunPumpkin); d.line(5, 7, 5, 14, '#d08a1a'); d.line(11, 7, 11, 14, '#d08a1a');
    for (const [x, y] of [[5, 4], [11, 4], [8, 2]]) d.ellipse(x, y, 1.5, 1.5, C.sunflowerPetals);
    d.px(8, 4, C.sunflowerCenter);
  },
  moonMushroom(d) {
    d.ellipse(8, 8, 6, 3.5, C.moonCap, true); for (let x = 1; x < 15; x++) for (let y = 9; y < 12; y++) d.px(x, y, null);
    d.rect(6, 9, 4, 5, C.mushroomStem); d.ellipse(6, 6, 1.5, 1.5, '#fff8d0', true);
  },
  starbloom(d) {
    for (let k = 0; k < 5; k++) { const a = ((-90 + 72 * k) * Math.PI) / 180; d.line(8, 8, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, C.starbloom, true); }
    d.ellipse(8, 8, 1.5, 1.5, '#fff6c8', true);
  },
  goldPumpkin(d) {
    d.ellipse(8, 9, 7, 5, C.goldPumpkin); d.line(5, 5, 5, 13, '#c9961a'); d.line(11, 5, 11, 13, '#c9961a'); d.rect(7, 2, 2, 3, C.stem);
    d.px(10, 7, '#fffbe0', true);
  },
};

export function drawHeldSheet() {
  const sheet = new PixelSheet(HELD_FRAME.frameW * PLANT_ORDER.length, HELD_FRAME.frameH);
  PLANT_ORDER.forEach((type, col) => artOf(DRAW_HELD, type)(sheet.frame(col, 0, 16, 16)));
  return sheet.finish();
}

// ---------- Инструменты в лапах ----------
// Кадр 16×16. Строка 0: лейка, корзинка сзади (ручка и тёмное нутро), корзинка спереди (плетёный бок).
// Между задом и передом корзинки рисуются собранные овощи из листа урожая — так они «сидят» внутри.
// Строка 1: мешочек с семенами, по колонке на растение (в порядке PLANT_ORDER) — метка цвета растения.
export const TOOL_FRAME = { frameW: 16, frameH: 16, cols: Math.max(4, PLANT_ORDER.length) };
export const TOOL_FRAMES = { water: [0, 0], basket: [1, 0], basketFront: [2, 0], lantern: [3, 0] }; // [колонка, строка]; water и basket — по инструменту
export const SEED_BAG_ROW = 1;

const SEED_LABEL = {
  carrot: C.carrot, radish: C.radish, pumpkin: C.pumpkin, sunflower: C.sunflowerPetals, mushroom: C.mushroomCap,
  fireroot: C.firerootRoot, lanternPumpkin: C.lanternPumpkin, sunPumpkin: C.sunPumpkin, moonMushroom: C.moonCap,
  starbloom: C.starbloom, goldPumpkin: C.goldPumpkin,
};

function drawCan(d) {
  d.line(4, 6, 9, 6, C.wateringCanDark);  // ручка сверху
  d.px(3, 7, C.wateringCanDark);
  d.px(10, 7, C.wateringCanDark);
  d.rect(3, 8, 8, 6, C.wateringCan);      // бак
  d.rect(3, 10, 8, 1, C.wateringCanDark); // обод
  d.rect(4, 14, 6, 1, C.wateringCanDark); // донышко
  d.line(11, 12, 14, 8, C.wateringCan);   // носик
  d.line(11, 13, 14, 9, C.wateringCan);
  d.rect(14, 6, 2, 3, C.wateringCanDark); // рассеиватель
}

function drawBasketBack(d) {
  d.line(3, 8, 5, 3, C.basket);           // ручка дугой
  d.line(5, 3, 10, 3, C.basket);
  d.line(10, 3, 12, 8, C.basket);
  d.ellipse(7.5, 8, 5.5, 1.5, C.basketInside);
}

// Фонарь енота (ночью висит у него сбоку): дужка, рамка, светящееся стекло
function drawLantern(d) {
  d.line(6, 2, 9, 2, C.wateringCanDark);   // дужка
  d.px(5, 3, C.wateringCanDark);
  d.px(10, 3, C.wateringCanDark);
  d.rect(5, 4, 6, 1, C.wateringCanDark);   // крышка
  d.rect(5, 5, 6, 7, '#ffd27a', true);     // стекло светится
  d.rect(7, 6, 2, 4, '#fff4c8', true);     // огонёк
  d.line(5, 5, 5, 11, C.wateringCanDark);  // рамка
  d.line(10, 5, 10, 11, C.wateringCanDark);
  d.rect(5, 12, 6, 1, C.wateringCanDark);  // донышко
}

function drawBasketFront(d) {
  d.rect(2, 9, 12, 4, C.basket);
  d.rect(3, 13, 10, 2, C.basket);
  for (let x = 2; x < 14; x += 2) d.line(x, 9, x, 14, C.basketInside); // плетёнка
  d.rect(2, 9, 12, 1, C.hat);             // светлый край
}

function drawSeedBag(d, label) {
  d.ellipse(8, 11, 5, 4, C.seedBag);
  d.rect(6, 5, 4, 3, C.seedBag);          // горлышко
  d.px(5, 4, C.seedBag);                  // уголки над завязкой
  d.px(10, 4, C.seedBag);
  d.line(5, 7, 10, 7, C.seedBagTie);      // завязка
  d.ellipse(8, 11, 2, 1.5, label);        // метка: что за семена
}

export function drawToolSheet() {
  const { frameW, frameH, cols } = TOOL_FRAME;
  const sheet = new PixelSheet(frameW * cols, frameH * 2);
  drawCan(sheet.frame(...TOOL_FRAMES.water, frameW, frameH));
  drawBasketBack(sheet.frame(...TOOL_FRAMES.basket, frameW, frameH));
  drawBasketFront(sheet.frame(...TOOL_FRAMES.basketFront, frameW, frameH));
  drawLantern(sheet.frame(...TOOL_FRAMES.lantern, frameW, frameH));
  PLANT_ORDER.forEach((type, col) => drawSeedBag(sheet.frame(col, SEED_BAG_ROW, frameW, frameH), artOf(SEED_LABEL, type) || C.seed));
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
// Кадр 32×32. Строки: 0 — призрак, 1 — скелет, 2 — блуждающий огонь, 3 — мелочи: монета (кадр 0; дух несёт её из корзинки),
// огонёк (кадры 1–4; остаётся от прогнанного духа, мерцает).
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

// Огонёк: маленькое тёплое пламя, мерцает (i — кадр 0–3)
function drawEmber(d, i) {
  const h = [0, 1, 0, -1][i];
  d.ellipse(16, 19, 3.5, 3.5, C.emberFlame, true);
  d.line(16, 16, 16 + [0, 1, 0, -1][(i + 1) % 4], 11 - h, C.emberFlame, true);
  d.line(15, 17, 14, 13 - h, C.emberFlame, true);
  d.line(17, 17, 18, 13 + h, C.emberFlame, true);
  d.ellipse(16, 19, 2, 2, C.emberCore, true);
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
  for (let i = 0; i < 4; i++) drawEmber(sheet.frame(1 + i, SPIRIT.rows_.coin, 32, 32), i);
  return sheet.finish();
}
