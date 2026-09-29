// Все игровые числа — здесь. Меняй смело: после сохранения файла игра обновится сама.

// Цвета предметов (полный цвет; общий тон картинке задаёт цветокоррекция — см. FX ниже)
export const COLORS = {
  background: '#171722',   // ночное небо вокруг острова
  ground: '#667336',       // осенняя трава острова
  soil: '#5c3d27',         // земля грядок
  soilWet: '#3a2618',      // политая земля
  soilRipe: '#86603a',     // клетка со спелым урожаем
  mound: '#6e4a2f',        // бугорок над семечком
  seed: '#e6c27a',
  leaves: '#5c8a34',       // ботва
  carrot: '#f07a1a',
  radish: '#d63a55',
  pumpkin: '#e88420',
  stem: '#6b7a2a',
  sunflowerPetals: '#f5c542',
  sunflowerCenter: '#4a2a12',
  mushroomStem: '#e8dcc0',
  mushroomCap: '#6fe3ff',  // светится
  houseWalls: '#c9a37b',
  houseRoof: '#8c3b2b',
  houseDoor: '#4a2c1a',
  houseWindow: '#ffd08a',  // светится
  houseTrim: '#5a3a22',    // брёвна, рамы, наличники
  houseShutters: '#3f6b5a',
  houseStep: '#8a877e',
  houseAccent: '#d4a84a',  // дверная ручка
  lamp: '#ffcf7a',         // фонарик и круглое окошко — светятся
  barrel: '#8a5a32',
  logs: '#a0703f',
  cliff: '#6b4a32',        // бока острова
  treeTrunk: '#5a3d28',
  leavesA: '#e0752a',      // осенняя листва
  leavesB: '#c2482a',
  rope: '#d8c08a',
  swingSeat: '#8a5a32',
  boulder: '#8d8a80',
  tallGrass: '#b8a24a',
  basket: '#c08a4a',
  basketInside: '#5a3a20',
  basketFill: '#f07a1a',
  // Что енот держит в лапах
  wateringCan: '#5f8f86',   // лейка
  wateringCanDark: '#3f615b',
  seedBag: '#c9a877',       // мешочек с семенами
  seedBagTie: '#7a5a32',
  // Крот (второй скин)
  moleBody: '#4a3a36',
  moleSnout: '#e8a8a0',
  moleNose: '#ff8fa0',
  moleEyes: '#111111',
  molePaws: '#e8b0a0',
  // Енот (главный герой)
  raccoonBody: '#8e8880',   // серая шерсть
  raccoonDark: '#3a3432',   // маска, лапки, ушки, полоски на хвосте
  raccoonLight: '#e8e2d6',  // мордочка, щёки, светлые полоски
  raccoonNose: '#1e1a18',
  raccoonEyes: '#111111',
  // Духи (ночью светятся)
  ghost: '#e6eeff',         // призрак
  ghostShade: '#a9b6e6',
  ghostCheeks: '#ffb3cc',
  spiritEyes: '#2a2440',
  bone: '#efe8d6',          // скелет
  boneShade: '#b3a98f',
  boneGlow: '#7ae8ff',      // огоньки в глазницах
  wispCore: '#fff4c2',      // блуждающий огонь
  wispFlame: '#79d8ff',
  wispTip: '#b8f0ff',
  spiritCoin: '#f2c24a',    // монета в лапах у духа
  emberCore: '#fff1c4',     // огонёк — второй ресурс (от прогнанного духа): тёплое ядро…
  emberFlame: '#ffab4a',    // …и янтарное пламя
  // Одежда огородника (общая для всех скинов)
  overalls: '#3a5a8a',
  hat: '#e8cf8a',
  hatBand: '#a0302a',
  stone: '#9a968a',
  stoneDark: '#6a665c',
  grass: '#8a9a3a',
  flower: '#e85a8a',
  flowerCenter: '#f5c542',
  vane: '#3a3a3a',
  smoke: '#c8c0b8',
  fluff: '#fff4dc',
  firefly: '#d8ff6a',
  water: '#8ad0ff',
  hoverFrame: '#fff4dc',  // рамка клетки под курсором
  frontCell: '#ffcf7a',   // клетка, с которой работает герой (под ним)
};

// Огород
export const GARDEN_SIZE = 8;   // клеток по стороне
export const CELL_SIZE = 1;     // размер клетки в «метрах» сцены

// Координаты ниже — в клетках. Огород: от 0 до 7.
// Вокруг огорода дорожка шириной в одну клетку: -1 и 8.
export const BASKET_CELL = { x: 4, z: -1 };   // корзинка стоит на дорожке у дома, посередине верхнего края огорода
export const HERO_START = { x: 4, z: 8 };     // где герой появляется

// Растения, в порядке открытия.
//   stageSeconds — сколько секунд длится каждая стадия после полива
//                  (семечко → росток → куст → спелое, то есть рост целиком = 3 × stageSeconds)
//   seedPrice    — цена семечка в магазине (0 — бесплатно и бесконечно)
//   sellPrice    — сколько монет даёт корзинка за урожай
//   unlock       — когда открывается: собрать count штук растения plant
//   forms        — как сказать «собери 1 / 3 / 5 …» (для подсказок)
//   defense      — как защищает ночью, если спелое и не собрано:
//                  role — роль (для магазина), hold — сколько секунд дух тянет это растение, прежде чем утащить
//                  (нет — обычное время, SPIRITS.grabSeconds), nights — сколько ночей служит, потом отцветает,
//                  seeds — сколько семян оставляет [от, до]
//   attack       — как бьёт духов (ряд — столбец клеток от дальнего края огорода к дому; «вперёд» — к туману):
//                  type — вид атаки: whip — хлещет ботвой свою клетку и reach клеток вперёд по своему ряду;
//                         spark — стреляет искрой вперёд по ряду в ближайшего духа (на reach клеток), speed — скорость искры;
//                         wall — бьёт только духа на своей клетке; beam — луч на reach клеток вперёд по своему ряду и двум соседним;
//                         spores — волна спор вокруг себя на reach клеток во все стороны (1 — квадрат 3×3)
//                  power — сколько смелости отнимает удар (см. SPIRITS → courage), every — перерыв между ударами (секунд)
export const PLANTS = {
  carrot:    { name: 'Морковь',         stageSeconds: 20,  seedPrice: 0,   sellPrice: 2,   unlock: null,                           forms: ['морковку', 'морковки', 'морковок'],
    defense: { role: 'хлещет ботвой соседнюю клетку', nights: 1, seeds: [1, 1] },
    attack: { type: 'whip', reach: 1, power: 1, every: 1.5 } },
  radish:    { name: 'Редис',           stageSeconds: 30,  seedPrice: 5,   sellPrice: 8,   unlock: { plant: 'carrot', count: 5 },    forms: ['редиску', 'редиски', 'редисок'],
    defense: { role: 'стреляет жгучими искрами вдоль ряда', nights: 2, seeds: [1, 2] },
    attack: { type: 'spark', reach: 8, power: 1, every: 2, speed: 5 } },
  pumpkin:   { name: 'Тыква',           stageSeconds: 60,  seedPrice: 15,  sellPrice: 30,  unlock: { plant: 'radish', count: 5 },    forms: ['тыкву', 'тыквы', 'тыкв'],
    defense: { role: 'стена: дух долго упирается в неё', hold: 15, nights: 3, seeds: [1, 2] },
    attack: { type: 'wall', reach: 0, power: 0.5, every: 3 } },
  sunflower: { name: 'Подсолнух',       stageSeconds: 120, seedPrice: 40,  sellPrice: 80,  unlock: { plant: 'pumpkin', count: 3 },   forms: ['подсолнух', 'подсолнуха', 'подсолнухов'],
    defense: { role: 'луч на 3 клетки по трём рядам', nights: 3, seeds: [1, 2] },
    attack: { type: 'beam', reach: 3, power: 1, every: 3 } },
  mushroom:  { name: 'Светящийся гриб', stageSeconds: 300, seedPrice: 100, sellPrice: 250, unlock: { plant: 'sunflower', count: 3 }, forms: ['гриб', 'гриба', 'грибов'],
    defense: { role: 'волна спор вокруг себя, 3×3', nights: 3, seeds: [1, 1] },
    attack: { type: 'spores', reach: 1, power: 2, every: 4 } },
};

// Корзинка для сбора (инструмент 3): сколько овощей помещается. Полную относят к большой корзине у дома.
// Уровни по порядку: первый — с самого начала, дальше — улучшения в магазине.
//   capacity — сколько помещается, price — цена улучшения в монетах
export const HAND_BASKET = [
  { capacity: 2 },
  { capacity: 3, price: 20 },
  { capacity: 4, price: 60 },
  { capacity: 5, price: 150 },
];

// Скорость роста всех растений: 1 — обычная, 10 — в десять раз быстрее (удобно для проверки)
export const GROWTH_SPEED = 1;

// Мелкие детали сцены
export const DECOR = {
  stones: 12,
  grassTufts: 18,
  flowers: 5,
  fireflies: 6, // светлячки: изредка появляются и кружат на месте
  leaves: 7,    // листья, которые ветер носит по острову
  wind: 0.8,    // сила ветра: 0 — штиль, 1 — ветрено
  smokePuffs: 4,       // сколько клубов дыма одновременно
};

// Эффекты из частиц
export const EFFECTS = {
  sporeEvery: 0.6, // как часто спелые грибы выпускают светящиеся споры (секунд)
};

// Погода (только для красоты — на рост растений не влияет)
export const WEATHER = {
  clearMinutes: [1, 3],   // сколько длится ясная погода (случайно между, в минутах): в среднем дождь раз в 2 минуты
  rainMinutes: [0.25, 0.25], // сколько длится дождь: 0.25 минуты = 15 секунд
  drops: 500,             // сколько капель одновременно (на телефоне меньше)
  rainColor: '#b8c4e0',
  // лужи: [клетка x, клетка z, размер] — на дорожке вокруг огорода и у дома
  puddles: [[-1, 5, 1.1], [3, 8, 1.3], [8, 6, 1], [8, 0, 1.2], [1, -1, 1.1], [5, -1, 0.9]],
};

// Камера (только сенсорные экраны): минимальная ширина ромбика клетки, в точках (высота — примерно 0,6 от неё). Если огород целиком
// в экран не помещается (телефон), камера приближается и сцену можно двигать пальцем.
export const MIN_CELL_PX = 72;

// Герой
export const HERO_SKIN = 'raccoon';  // кто герой: 'raccoon' — енот, 'mole' — крот
export const HERO_SPEED = 3;         // клеток в секунду
export const HERO_TURN_SPEED = 12;   // как быстро поворачивается
export const HERO_SCALE = 1;         // размер героя
// Грядка для действия — та, на которой стоит герой. Корзинка — если она ближе этого расстояния
// перед носом героя (в клетках): меньше 0,5 не ставь, иначе до корзинки не дотянуться.
export const HERO_REACH = 0.55;

// Уровни качества картинки (выбирается автоматически: телефон — low, компьютер — high)
//   msaa        — сглаживание краёв (0 — выкл, 4 — хорошее)
//   maxDpr      — предел чёткости экрана (меньше — быстрее)
//   shadowMap   — размер карты теней (больше — чётче тени)
//   ao          — мягкие затенения в углах
//   godRays     — лучи света
//   particles   — множитель количества частиц
//   lanternShadows — сколько фонарей отбрасывают тени (тени от фонарей дорогие)
//   lanternLights  — сколько фонарей по-настоящему светят (остальные — только светящееся стекло)
//   textureSize    — предел размера картинок-текстур (на телефоне меньше — меньше памяти)
//   fogLayers, fogWisps — сколько слоёв тумана под островом и клочьев тумана у краёв
export const QUALITY = {
  low:    { tiltShift: false, msaa: 0, maxDpr: 1, shadowMap: 1024, ao: false, godRays: false, particles: 0.4, lanternShadows: 0, lanternLights: 3, textureSize: 512, fogLayers: 2, fogWisps: 4 },
  medium: { tiltShift: true, msaa: 2, maxDpr: 1.25, shadowMap: 1024, ao: false, godRays: true, particles: 0.7, lanternShadows: 0, lanternLights: 5, textureSize: 1024, fogLayers: 3, fogWisps: 6 },
  high:   { tiltShift: true, msaa: 2, maxDpr: 1.5, shadowMap: 2048, ao: true, godRays: true, particles: 1, lanternShadows: 1, lanternLights: 7, textureSize: 1024, fogLayers: 3, fogWisps: 8 },
  ultra:  { tiltShift: true, msaa: 4, maxDpr: 2, shadowMap: 4096, ao: true, godRays: true, particles: 1.5, lanternShadows: 3, lanternLights: 7, textureSize: 1024, fogLayers: 4, fogWisps: 10 },
};

// Нечисть: ночью духи поднимаются из тумана с дальнего края огорода и идут к дому, каждый по своему ряду
// (ряд — столбец из 8 клеток от дальнего края к дому, выбирается случайно). Первое спелое растение на пути дух
// пытается утащить; незрелые проходит насквозь. Прошёл ряд — сворачивает к корзинке за монетами.
// Спелые несобранные растения бьют духов (PLANTS → attack): каждый удар отнимает смелость, дух бледнеет и дрожит.
// Смелость кончилась — дух пугается, убегает, роняет добычу и оставляет огонёк.
// Духов никто не уничтожает; набеги — только во время игры.
export const SPIRITS = {
  perNight: [5, 6],      // сколько духов приходит за ночь (случайно между)
  firstDelay: 5,         // через сколько секунд после начала ночи приходит первый (в секундах)
  interval: [26, 34],    // пауза между духами (секунд, случайно между)
  warnSeconds: 2.5,      // сколько секунд перед появлением духа в тумане у его ряда светится знак и звучит «у-у»
  coinShare: 0.1,        // из корзинки дух уносит такую долю монет…
  maxCoins: 20,          // …но не больше стольких
  grabSeconds: 5,        // сколько дух тянет растение (или копается в корзинке), прежде чем утащить (тыква — дольше, PLANTS → defense → hold)
  leaveSpeed: 1.5,       // с добычей (или ни с чем) дух уходит обратно в туман во столько раз быстрее
  // виды духов: имя (для подсказок), скорость (клеток в секунду: 0.33 — клетка за 3 секунды), как часто встречается,
  // courage — смелость: сколько ударов растений выдерживает, прежде чем испугаться (удары — PLANTS → attack → power)
  kinds: {
    ghost: { name: 'Призрак', speed: 0.33, weight: 3, courage: 4 },
    skeleton: { name: 'Скелет', speed: 0.28, weight: 2, courage: 6 },
    wisp: { name: 'Блуждающий огонь', speed: 0.42, weight: 2, courage: 3 },
  },
  fleeSpeed: 3,          // как быстро убегает испуганный дух (клеток в секунду)
  emberReach: 0.7,       // огонёк от прогнанного духа: с какого расстояния енот его подбирает (в клетках)
};

// Смена дня и ночи (идёт только во время игры; при каждом входе в игру — утро).
// Части суток по кругу, длина — в минутах. speed — ускорение (2 — вдвое быстрее, удобно для проверки).
export const DAY_CYCLE = {
  phases: [
    { id: 'morning', name: 'утро', minutes: 1.5 },
    { id: 'day', name: 'день', minutes: 5 },
    { id: 'evening', name: 'вечер', minutes: 2 },
    { id: 'night', name: 'ночь', minutes: 3.5 },
  ],
  speed: 1,
  sunPeak: 42,   // как высоко солнце в полдень (градусы): ниже — длиннее тени
  moonPeak: 35,  // и луна в полночь
};

// Как выглядит каждая часть суток (в середине части; между ними — плавный переход).
//   sky          — небо сверху вниз [место 0..1, цвет] (если в art/ есть картинка sky-<часть>.png — берётся она)
//   skyLight     — цвет и сила рассеянного света неба
//   sun          — цвет и сила солнца (ночью — луны)
//   reflections  — насколько блестящее отражает небо
//   lut          — цветокоррекция (см. render/luts.js)
//   lamps        — фонари и окна: 0 — погашены, 1 — горят
//   stars        — звёзды на небе: 0 — нет, 1 — все
//   rays         — лучи света сквозь воздух (от солнца, ночью — от луны): 0 — нет, 1 — во всю силу
//   moonlight    — лунное пятно над серединой огорода: 0 — нет, 1 — во всю силу
export const DAYTIME = {
  morning: {
    sky: [[0, '#3d3f78'], [0.45, '#9a6f9e'], [0.75, '#e38f7c'], [1, '#f5a86a']],
    skyLight: '#b098d0', skyLightIntensity: 1.25, sun: '#ff9a62', sunIntensity: 3.2,
    reflections: 0.6, lut: 'morning', lamps: 0.25, stars: 0.15, rays: 0.3, moonlight: 0,
  },
  day: {
    sky: [[0, '#7d6f93'], [0.45, '#c98a62'], [0.75, '#dd9154'], [1, '#e39e62']],
    skyLight: '#c9a0a0', skyLightIntensity: 1.15, sun: '#ffb86e', sunIntensity: 4,
    reflections: 0.8, lut: 'day', lamps: 0, stars: 0, rays: 0, moonlight: 0,
  },
  evening: {
    sky: [[0, '#1e2236'], [0.5, '#3a3450'], [0.8, '#554457'], [1, '#735a5a']],
    skyLight: '#6a78b8', skyLightIntensity: 1.2, sun: '#ff7a3a', sunIntensity: 3,
    reflections: 0.6, lut: 'evening', lamps: 1, stars: 0.2, rays: 0, moonlight: 0,
  },
  night: {
    sky: [[0, '#080a16'], [0.5, '#121633'], [0.8, '#1d1f3f'], [1, '#2a2742']],
    skyLight: '#5564a0', skyLightIntensity: 0.95, sun: '#8ea4e6', sunIntensity: 1.2,
    reflections: 0.35, lut: 'night', lamps: 1, stars: 1, rays: 0.45, moonlight: 1,
  },
};

// Туман под островом и вокруг (остров парит над ним). Цвет туман берёт у неба — у горизонта.
// Слоёв и клочьев — по уровню качества (QUALITY → fogLayers, fogWisps).
export const FOG_SEA = {
  cloudiness: 0.47,  // 0 — лёгкая прозрачная дымка, 1 — плотное море облаков с разрывами
  density: 0.1,     // сколько тумана: 0 — почти нет, 1 — сплошной
  top: -5.3,        // на какой глубине под землёй верхний слой
  spacing: 1.9,     // расстояние между слоями (чем больше — тем сильнее «глубина» при повороте)
  size: 12.5,          // размер облаков (в клетках)
  speed: 0.14,      // как быстро плывёт
  brightness: 0.2,  // светлота верхушек облаков
  warmGlow: 0.4,    // тёплый отсвет фонарей на тумане под островом
  wispOpacity: 0.5, // клочья тумана у краёв острова: прозрачность
};

// Свет, общий для всех частей суток (цвета неба, солнца и прочее по времени — выше, в DAYTIME)
export const LIGHTING = {
  skyReflex: 0.5,                  // отсвет неба на краях предметов (0 — нет)
  bottomFade: 0.55,                // насколько низ острова растворяется в дымке (0 — нет, 1 — полностью)
  // тёплый ореол за островом (в долях экрана): будто свет фонарей рассеивается в воздухе (гаснет вместе с фонарями)
  halo: { color: '#ffb070', strength: 0.22, x: 0.5, y: 0.5, radius: 0.45 },
  fogNear: 42, fogFar: 110,        // дымка вдали (цвет — от неба)
  groundColor: '#3a2618',          // отсвет земли снизу
  shadowStrength: 0.55,            // густота теней от солнца: 1 — чёрные, 0 — нет
  lanternColor: '#ffb45a', lanternIntensity: 16, lanternDistance: 6, // фонари
  coneStrength: 0.035,              // яркость конусов света под фонарями (0 — нет)
  rays: { count: 7, strength: 0.4, length: 10 }, // лучи света сквозь воздух (сила по времени суток — DAYTIME.rays)
  moonPool: { color: '#a8bcff', intensity: 2.2, radius: 4.5 }, // лунное пятно над огородом (ночью)
};

// Где стоят фонари (координаты сцены)
export const LANTERNS = {
  posts: [
    { x: 5.2, z: 5.2 }, { x: -5.2, z: 5.2 }, { x: 5.2, z: -2.0 }, { x: -5.2, z: 0.6 }, { x: -2.2, z: -5.25 },
  ],
  tree: { x: -3.0, y: 1.55, z: -6.6 },   // фонарик на дереве у качелей
  door: { x: -0.48, y: 1.0, z: -5.05 },  // лампа у двери
};

// Реалистичные текстуры (картинки из art/): сколько клеток покрывает одна картинка и сила рельефа
export const REALISTIC = {
  // roughness — шероховатость: 1 — совсем матово, меньше — появляются блики от фонарей и отражение неба
  grass:  { units: 4, relief: 3, roughness: 1 },
  cliff:  { units: 4, relief: 4, roughness: 1 },
  soil:   { units: 2, relief: 4, roughness: 0.95 },
  stone:  { units: 2, relief: 3, roughness: 0.8 },
  planks: { units: 3, relief: 4, roughness: 0.9 },
  roof:   { units: 2, relief: 4, roughness: 0.65 },
  bark:   { units: 2, relief: 4, roughness: 1 },
  leaves: { units: 2, relief: 3, roughness: 0.85 },
  wood:   { units: 2, relief: 3, roughness: 0.85 },
  wicker: { units: 1, relief: 4, roughness: 0.9 },
};

// Сила свечения светящихся предметов (фонарь, окна, гриб): больше 1 — «горячее» белого, ловит bloom
export const GLOW = 3;

// Картинка по умолчанию (панель G меняет, «скопировать значения» — чтобы вписать сюда)
export const FX = {
  bloomIntensity: 1.2,  // сила свечения
  bloomThreshold: 0.9,  // с какой яркости начинает светиться
  bloomRadius: 0.7,     // как широко расходится свечение
  lut: 'auto',          // цветокоррекция: auto — по времени суток; или одна на всё время: morning, day, evening, night, autumn, sunset, dusk, neutral
  lutStrength: 1,
  vignette: 0.5,        // затемнение по краям
  grain: 0.12,          // плёночное зерно
  aoIntensity: 2.5,     // затенения в углах: сила
  aoRadius: 1.2,        // и насколько далеко от угла
  tiltFocus: 1.39,      // миниатюра: ширина резкой полосы по середине экрана
  tiltFeather: 1,       // насколько плавно резкое переходит в размытое
  tiltOffset: 0,        // сдвиг резкой полосы вверх/вниз
};

// Камера
export const CAMERA = {
  breath: 0.035,        // «дыхание» камеры: насколько плавно покачивается (0 — стоит неподвижно)
  followOnPhone: true,  // на телефоне камера мягко следует за героем, если он уходит к краю
  closeUpZoom: 2.5,     // крупный план (кнопка-лупа, клавиша Z): во сколько раз ближе вида «весь остров»
  rotateTime: 0.6,      // поворот мира на 90° (стрелки, клавиши Q/E): за сколько секунд (0 — мгновенно)
};

// Звук (всё создаётся в коде, файлов нет). Громкость: 0 — тишина, 1 — полная.
// В меню (Esc) — звуки и музыка вкл/выкл и громкость (быстро: клавиши N и M); выбор запоминается.
export const SOUND = {
  master: 0.8,      // общая громкость
  effects: 0.7,     // действия: посадка, полив, сбор, монеты, шаги, кнопки
  ambience: 0.45,   // фон природы: ветер, сверчки, дождь
  music: 0.35,      // мелодия
  steps: 0.5,       // шаги героя (доля от громкости действий)
  wind: 0.2,        // ветер и шелест листвы (доля от громкости природы): 0.2 — еле слышно, 1 — как буря
  stepEvery: 0.42,  // шаг каждые … клетки пути
  crickets: 1,      // сверчков вечером и ночью: 0 — нет, 1 — обычно, 2 — хор (во время дождя стихают)
  owlEveryMinutes: [1.5, 4], // сова ухает изредка ночью (случайно между, в минутах)
  tempo: 66,        // скорость мелодии, ударов в минуту (медленнее — спокойнее)
  nightMusic: 0.4,  // насколько ночью музыка тише (0 — как днём, 1 — молчит); заодно чуть медленнее
};
