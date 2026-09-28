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
  frontCell: '#ffcf7a',   // клетка перед героем
};

// Огород
export const GARDEN_SIZE = 8;   // клеток по стороне
export const CELL_SIZE = 1;     // размер клетки в «метрах» сцены

// Координаты ниже — в клетках. Огород: от 0 до 7.
// Вокруг огорода дорожка шириной в одну клетку: -1 и 8.
export const BASKET_CELL = { x: -1, z: 1 };   // корзинка стоит на дорожке
export const HERO_START = { x: 4, z: 8 };     // где герой появляется

// Растения, в порядке открытия.
//   stageSeconds — сколько секунд длится каждая стадия после полива
//                  (семечко → росток → куст → спелое, то есть рост целиком = 3 × stageSeconds)
//   seedPrice    — цена семечка в магазине (0 — бесплатно и бесконечно)
//   sellPrice    — сколько монет даёт корзинка за урожай
//   unlock       — когда открывается: собрать count штук растения plant
//   forms        — как сказать «собери 1 / 3 / 5 …» (для подсказок)
export const PLANTS = {
  carrot:    { name: 'Морковь',         stageSeconds: 20,  seedPrice: 0,   sellPrice: 2,   unlock: null,                           forms: ['морковку', 'морковки', 'морковок'] },
  radish:    { name: 'Редис',           stageSeconds: 30,  seedPrice: 5,   sellPrice: 8,   unlock: { plant: 'carrot', count: 5 },    forms: ['редиску', 'редиски', 'редисок'] },
  pumpkin:   { name: 'Тыква',           stageSeconds: 60,  seedPrice: 15,  sellPrice: 30,  unlock: { plant: 'radish', count: 5 },    forms: ['тыкву', 'тыквы', 'тыкв'] },
  sunflower: { name: 'Подсолнух',       stageSeconds: 120, seedPrice: 40,  sellPrice: 80,  unlock: { plant: 'pumpkin', count: 3 },   forms: ['подсолнух', 'подсолнуха', 'подсолнухов'] },
  mushroom:  { name: 'Светящийся гриб', stageSeconds: 300, seedPrice: 100, sellPrice: 250, unlock: { plant: 'sunflower', count: 3 }, forms: ['гриб', 'гриба', 'грибов'] },
};

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
// Как далеко перед носом героя выбирается клетка для действия (в клетках).
// Меньше — ближе к герою; меньше 0,5 не ставь: будет выбираться клетка под самим героем.
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

// Вечерний свет
export const LIGHTING = {
  // Небо: градиент сверху вниз [место 0..1, цвет]
  // приглушённый: без резких переходов, чтобы не спорил с освещённым островом.
  // Если в art/ есть sky.png — вместо градиента фоном будет картинка (ТЗ в ART.md)
  sky: [[0, '#1e2236'], [0.5, '#3a3450'], [0.8, '#554457'], [1, '#735a5a']],
  environmentIntensity: 0.6,       // насколько блестящее отражает небо
  skyReflex: 0.5,                  // отсвет неба на краях предметов (0 — нет)
  bottomFade: 0.55,                // насколько низ острова растворяется в дымке (0 — нет, 1 — полностью)
  // тёплый ореол за островом (в долях экрана): будто свет фонарей рассеивается в воздухе
  halo: { color: '#ffb070', strength: 0.22, x: 0.5, y: 0.5, radius: 0.45 },
  fogColor: '#3a3450', fogNear: 42, fogFar: 110, // дымка вдали
  skyLight: '#6a78b8', groundColor: '#3a2618', skyLightIntensity: 1.2, // рассеянный свет неба
  sunColor: '#ff7a3a', sunIntensity: 3,
  sunDirection: { azimuth: -70, elevation: 12 }, // откуда светит солнце (в градусах): низко — длинные тени
  shadowStrength: 0.55,            // густота теней от солнца: 1 — чёрные, 0 — нет
  lanternColor: '#ffb45a', lanternIntensity: 16, lanternDistance: 6, // фонари
  coneStrength: 0.035,              // яркость конусов света под фонарями (0 — нет)
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
  lut: 'evening',       // цветокоррекция: evening, autumn, sunset, dusk, neutral
  lutStrength: 1,
  vignette: 0.5,        // затемнение по краям
  grain: 0.12,          // плёночное зерно
  aoIntensity: 2.5,     // затенения в углах: сила
  aoRadius: 1.2,        // и насколько далеко от угла
  tiltFocus: 0.75,      // миниатюра: ширина резкой полосы по середине экрана
  tiltFeather: 0.35,    // насколько плавно резкое переходит в размытое
  tiltOffset: 0.05,     // сдвиг резкой полосы вверх/вниз
};

// Камера
export const CAMERA = {
  breath: 0.035,        // «дыхание» камеры: насколько плавно покачивается (0 — стоит неподвижно)
  followOnPhone: true,  // на телефоне камера мягко следует за героем, если он уходит к краю
  closeUpZoom: 2.5,     // крупный план (кнопка-лупа, клавиша Z): во сколько раз ближе вида «весь остров»
  rotateTime: 0.6,      // поворот мира на 90° (стрелки, клавиши Q/E): за сколько секунд (0 — мгновенно)
};

// Звук (всё создаётся в коде, файлов нет). Громкость: 0 — тишина, 1 — полная.
// Кнопки 🔊 и 🎵 в углу (или клавиши N и M) выключают звуки и музыку; выбор запоминается.
export const SOUND = {
  master: 0.8,      // общая громкость
  effects: 0.7,     // действия: посадка, полив, сбор, монеты, шаги, кнопки
  ambience: 0.45,   // фон природы: ветер, сверчки, дождь
  music: 0.35,      // мелодия
  steps: 0.5,       // шаги героя (доля от громкости действий)
  wind: 0.2,        // ветер и шелест листвы (доля от громкости природы): 0.2 — еле слышно, 1 — как буря
  stepEvery: 0.42,  // шаг каждые … клетки пути
  crickets: 1,      // сверчков: 0 — нет, 1 — обычно, 2 — хор (во время дождя стихают)
  owlEveryMinutes: [1.5, 4], // сова ухает изредка (случайно между, в минутах)
  tempo: 66,        // скорость мелодии, ударов в минуту (медленнее — спокойнее)
};
