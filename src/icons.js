// Пиксельные значки интерфейса: 16×16, чернильный контур и 1–2 цвета внутри (этап 14в).
// Каждая буква — пиксель своего цвета (PALETTE), «.» — пусто, «#» — цвет кнопки (для одноцветных значков-действий:
// меню, гербарий, повороты, лупа, крестик, галочка). На экране значок — ровно 16, 32 или 48 точек (ui.css).

const PALETTE = {
  k: '#3a2410', // чернила: контур
  c: '#fbefd5', // сливочный
  y: '#e0a93a', // золото
  Y: '#f9df86', // светлое золото
  d: '#a8661a', // тёмное золото
  o: '#d9662b', // оранжевый
  O: '#f6a849', // светло-оранжевый
  r: '#b8462e', // красный
  b: '#4f8fd0', // голубой
  B: '#a8d8f5', // светло-голубой
  g: '#5f7d34', // зелёный
  G: '#9cbf55', // светло-зелёный
  w: '#8a5a32', // дерево, земля
  W: '#d2a466', // светлое дерево, плетёнка
  p: '#8f7fcb', // лиловый
  P: '#d2c8f0', // светло-лиловый
  s: '#8f8a80', // камень
  S: '#d6d0c4', // светлый камень
  n: '#3b4f8f', // ночная синева
};

export const ICONS = {
  // ---------- Инструменты ----------
  // росток — «Семена»
  seeds: [
    '................',
    '................',
    '.kkk........kkk.',
    'kGGGkk....kkGGGk',
    'kGGGGGk..kGGGGGk',
    '.kGggGGkkGGggGk.',
    '..kkggGkkGggkk..',
    '....kkgggGkk....',
    '......kggk......',
    '......kggk......',
    '......kggk......',
    '..kkkkkggkkkkk..',
    '.kwWWWWWWWWWWwk.',
    'kwwWWWWWWWWWWwwk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  // лейка
  water: [
    '................',
    '................',
    '....kkkkkk......',
    '...k......k.....',
    '...k......k...kk',
    '.kkkkkkkkkkk.kBk',
    'kBBBBBBBBBbkkBk.',
    'kBbbbbbbbbbbBk..',
    'kBbbbbbbbbbbk...',
    'kBbbbbbbbbbk....',
    'kBbbbbbbbbbk....',
    'kBbbbbbbbbbk....',
    'kbbbbbbbbbbk....',
    '.kkkkkkkkkk.....',
    '................',
    '................',
  ],
  // корзинка для сбора
  basket: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....k......k....',
    '...k........k...',
    '...k........k...',
    'kkkkkkkkkkkkkkkk',
    'kWWWWWWWWWWWWWWk',
    '.kwWwWwWwWwWwWk.',
    '.kWwWwWwWwWwWwk.',
    '.kwWwWwWwWwWwWk.',
    '..kWwWwWwWwWwk..',
    '..kwwwwwwwwwwk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  // корзинка полна: над краем — урожай
  basketFull: [
    '................',
    '.....kkkkkk.....',
    '....k......k....',
    '...kkkk..kkkk...',
    '..krrrrkkOOOOk..',
    '..krrrrkkOoOOk..',
    'kkkkkkkkkkkkkkkk',
    'kWWWWWWWWWWWWWWk',
    '.kwWwWwWwWwWwWk.',
    '.kWwWwWwWwWwWwk.',
    '.kwWwWwWwWwWwWk.',
    '..kWwWwWwWwWwk..',
    '..kwwwwwwwwwwk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  // лавка с навесом — магазин
  shop: [
    '................',
    'kkkkkkkkkkkkkkkk',
    'kcrrcrrcrrcrrcck',
    'krrcrrcrrcrrcrrk',
    'kkkkkkkkkkkkkkkk',
    '.krkkrkkrkkrkkr.',
    '..k..........k..',
    '..kwWWWWWWWWwk..',
    '..kWkkkkWkkkWk..',
    '..kWkBBkWkGkWk..',
    '..kWkBBkWkGkWk..',
    '..kWkkkkWkGkWk..',
    '..kWWWWWWkGkWk..',
    'kkkkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwwwk',
    'kkkkkkkkkkkkkkkk',
  ],

  // ---------- Ресурсы и цифры ----------
  coin: [
    '................',
    '.....kkkkkk.....',
    '...kkYYYYYykk...',
    '..kYYyyyyyyydk..',
    '.kYyyyyyyyyyydk.',
    '.kYyyykkkkyyydk.',
    'kYyyykYdddkyyydk',
    'kYyyykddddkyyydk',
    'kYyyykddddkyyydk',
    'kyyyykddddkyyydk',
    '.kyyyykkkkyyydk.',
    '.kyyyyyyyyyyddk.',
    '..kyyyyyyyyddk..',
    '...kkddddddkk...',
    '.....kkkkkk.....',
    '................',
  ],
  // огонёк — то, что оставляет прогнанный дух
  ember: [
    '................',
    '........k.......',
    '.......kok......',
    '.......kok......',
    '......kooOk.....',
    '.....kooOOok....',
    '....kooOYOook...',
    '....koOYYYOok...',
    '...kooOYcYYOok..',
    '...koOYcccYOok..',
    '...koOYcccYOok..',
    '...koOYYcYYOok..',
    '....koOYYYOok...',
    '.....kkooookk...',
    '.......kkkk.....',
    '................',
  ],
  // мешочек семян
  bag: [
    '................',
    '......kkkk......',
    '.....kWWWWk.....',
    '......kkkk......',
    '.....kwrrwk.....',
    '....kWWkkWWk....',
    '...kWWWWWWWWk...',
    '..kWWWWWWWWWWk..',
    '.kWWWWGGGWWWWwk.',
    '.kWWWGGgGGWWWwk.',
    '.kWWWWGGGWWWWwk.',
    '.kWWWWWgWWWWwwk.',
    '.kwWWWWWWWWWwwk.',
    '..kwwwwwwwwwwk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  // мешочек пуст — сдулся
  bagEmpty: [
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kWWWWk.....',
    '......kkkk......',
    '.....kwrrwk.....',
    '....kWWkkWWk....',
    '...kWWWWWWWWk...',
    '..kWWWWWWWWWWk..',
    '.kwWWkWWWWkWWwk.',
    '.kwWWWkkkkWWWwk.',
    '..kwwwwwwwwwwk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  // часы — сколько растёт
  clock: [
    '................',
    '.....kkkkkk.....',
    '...kkcccccckk...',
    '..kccccckcccck..',
    '.kcccccckccccSk.',
    '.kcccccckccccSk.',
    'kccccccckcccccSk',
    'kccccccckkkkccSk',
    'kcccccccccccccSk',
    'kcccccccccccccSk',
    '.kcccccccccccSk.',
    '.kSccccccccccSk.',
    '..kSSccccccSSk..',
    '...kkSSSSSSkk...',
    '.....kkkkkk.....',
    '................',
  ],
  // луна — ночи на страже, ночь
  moon: [
    '................',
    '......kkkk......',
    '....kkYYYk......',
    '...kYYYkk.......',
    '..kYYYk.........',
    '..kYYk..........',
    '.kYYYk..........',
    '.kYYYk..........',
    '.kYYYk.......k..',
    '.kYyYYk.....kk..',
    '..kyYYYkk.kkYk..',
    '..kyyYYYYkkYYk..',
    '...kyyyYYYYYk...',
    '....kkyyyykk....',
    '......kkkk......',
    '................',
  ],
  sun: [
    '................',
    '.......kk.......',
    '..kk...kk...kk..',
    '..kk..kkkk..kk..',
    '.....kYYYYk.....',
    '....kYyyyyyk....',
    '.kkkkYyyyyyykkk.',
    'kk..kYyyyyyyk.kk',
    'kk..kYyyyyydk.kk',
    '.kkkkYyyyyddkkk.',
    '....kYyyyddk....',
    '.....kddddk.....',
    '..kk..kkkk..kk..',
    '..kk...kk...kk..',
    '.......kk.......',
    '................',
  ],
  // солнце у горизонта — утро и вечер
  sunrise: [
    '................',
    '................',
    '.......kk.......',
    '..kk...kk...kk..',
    '..kk........kk..',
    '......kkkk......',
    '....kkYYYYkk....',
    '...kYYyyyyyyk...',
    'kk.kYyyyyyyyk.kk',
    '..kYyyyyyyyddk..',
    'kkkkkkkkkkkkkkkk',
    '................',
    '..kkkkkkkkkkkk..',
    '................',
    '....kkkkkkkk....',
    '................',
  ],

  // ---------- Атаки растений (магазин, гербарий) ----------
  // хлыст — плеть лозы
  whip: [
    '................',
    '..........kkk...',
    '.........kGGGk..',
    '........kGgkGk..',
    '........kgk.kk..',
    '.......kgk......',
    '......kgGk......',
    '.....kgGk.......',
    '....kgGk..kk....',
    '...kgGk..kGGk...',
    '..kgGk..kGgGk...',
    '..kgGkkkGgGk....',
    '..kggGGGggk.....',
    '...kkgggkk......',
    '.....kkk........',
    '................',
  ],
  // искра
  spark: [
    '................',
    '.......kk.......',
    '.......kk.......',
    '......kYYk......',
    '......kYYk......',
    '..kk.kYccYk.kk..',
    '..kYkYYccYYkYk..',
    'kkkYYYccccYYYkkk',
    'kYYYcccccccYYYYk',
    'kkkYYYccccYYYkkk',
    '..kYkYYccYYkYk..',
    '..kk.kYccYk.kk..',
    '......kYYk......',
    '......kYYk......',
    '.......kk.......',
    '................',
  ],
  // стена — каменная кладка
  wall: [
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kSSSSSkSSSSSSSsk',
    'kSsssskSssssssk.',
    'kkkkkkkkkkkkkkkk',
    'kSSSkSSSSSSkSSSk',
    'kssskSsssssksssk',
    'kkkkkkkkkkkkkkkk',
    'kSSSSSkSSSSSSSSk',
    'kssssskssssssssk',
    'kkkkkkkkkkkkkkkk',
    'kSSSkSSSSSSkSSSk',
    'kssskssssssksssk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  // луч — подсолнух светит вперёд
  beam: [
    '................',
    '..kkk...........',
    '.kYYYk......kkkk',
    'kYyyyYk..kkkYYYk',
    'kYyddyYkkYYYYYYk',
    'kYyddyYYYYYccYYk',
    'kYyddyYYccccccck',
    'kYyddyYYYYYccYYk',
    'kYyyyYkkkYYYYYYk',
    '.kYYYk...kkkYYYk',
    '..kkk.......kkkk',
    '...kgk..........',
    '...kgk..........',
    '..kGgk..........',
    '..kgGk..........',
    '...kk...........',
  ],
  // споры — светящиеся пылинки над грибом
  spores: [
    '................',
    '..kk.......kk...',
    '.kPPk.....kPPk..',
    '.kPPk..kk..kk...',
    '..kk..kPPk......',
    '......kPPk..kk..',
    '..kk...kk..kPPk.',
    '.kPPk......kPPk.',
    '..kk.kkkkkk.kk..',
    '....kpppPPpk....',
    '...kppPpppppk...',
    '..kpppppppPppk..',
    '..kkkkkkkkkkkk..',
    '......kSSk......',
    '.....kkSSkk.....',
    '................',
  ],

  // ---------- Пузырь мысли ----------
  drop: [
    '................',
    '.......kk.......',
    '.......kk.......',
    '......kBBk......',
    '......kBbk......',
    '.....kBbbbk.....',
    '.....kBbbbk.....',
    '....kBBbbbbk....',
    '....kBbbbbbk....',
    '...kBBbbbbbbk...',
    '...kBbbbbbbnk...',
    '...kBbbbbbbnk...',
    '...kbbbbbbnnk...',
    '....kbbbnnnk....',
    '.....kkkkkk.....',
    '................',
  ],
  // капля пустая — грядка просит воды
  dropEmpty: [
    '................',
    '.......kk.......',
    '.......kk.......',
    '......k..k......',
    '......k..k......',
    '.....k....k.....',
    '.....k....k.....',
    '....k......k....',
    '....k......k....',
    '...k........k...',
    '...k........k...',
    '...k........k...',
    '...k........k...',
    '....k......k....',
    '.....kkkkkk.....',
    '................',
  ],
  // ямка в земле — здесь пусто, нужно посадить
  hole: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '..kkWWWWWWWWkk..',
    '.kWWkkkkkkkkWWk.',
    'kWWkwwwwwwwwkWWk',
    'kWkwwkkkkkkwwkWk',
    'kWWkwwwwwwwwkWWk',
    '.kWWkkkkkkkkWWk.',
    '..kkWWWWWWWWkk..',
    '....kkkkkkkk....',
    '................',
    '................',
  ],

  // ---------- Кнопки-действия: одноцветные, цвет — у кнопки ----------
  menu: [
    '................',
    '................',
    '................',
    '..############..',
    '..############..',
    '................',
    '................',
    '..############..',
    '..############..',
    '................',
    '................',
    '..############..',
    '..############..',
    '................',
    '................',
    '................',
  ],
  // раскрытая книга — гербарий
  book: [
    '................',
    '................',
    '.#####....#####.',
    '#.....#..#.....#',
    '#.###..##..###.#',
    '#......##......#',
    '#.####.##.####.#',
    '#......##......#',
    '#.###..##..###.#',
    '#......##......#',
    '#.####.##.####.#',
    '#......##......#',
    '.######..######.',
    '.......##.......',
    '................',
    '................',
  ],
  // лупа — крупный план
  zoom: [
    '................',
    '....######......',
    '..##########....',
    '.###......###...',
    '.##........##...',
    '##..........##..',
    '##..........##..',
    '##..........##..',
    '##..........##..',
    '.##........##...',
    '.###......###...',
    '..##########....',
    '....######.###..',
    '............###.',
    '.............###',
    '..............##',
  ],
  // круговая стрелка по часовой — повернуть мир вправо
  rotateRight: [
    '................',
    '................',
    '.....######.....',
    '...##########...',
    '..###......###..',
    '.###........###.',
    '.##..........##.',
    '.##.......######',
    '.##........####.',
    '.##.........##..',
    '.###............',
    '..####..........',
    '...######.......',
    '.....####.......',
    '................',
    '................',
  ],
  // крестик — закрыть
  close: [
    '................',
    '................',
    '................',
    '...##......##...',
    '...###....###...',
    '....###..###....',
    '.....######.....',
    '......####......',
    '......####......',
    '.....######.....',
    '....###..###....',
    '...###....###...',
    '...##......##...',
    '................',
    '................',
    '................',
  ],
  // галочка — куплено
  check: [
    '................',
    '................',
    '................',
    '................',
    '.............##.',
    '............###.',
    '...........###..',
    '..##......###...',
    '..###....###....',
    '...###..###.....',
    '....######......',
    '.....####.......',
    '......##........',
    '................',
    '................',
    '................',
  ],
};
// против часовой — то же зеркально
ICONS.rotateLeft = ICONS.rotateRight.map((row) => [...row].reverse().join(''));

// Значок как SVG: квадратики без сглаживания, по одному <path> на цвет
const cache = {};
export function pixelIcon(name) {
  if (cache[name]) return cache[name];
  const paths = {};
  ICONS[name].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      (paths[ch] ??= []).push(`M${x} ${y}h1v1h-1z`);
    });
  });
  const svg = Object.entries(paths)
    .map(([ch, d]) => `<path d="${d.join('')}"${ch === '#' ? '' : ` fill="${PALETTE[ch]}"`}/>`)
    .join('');
  cache[name] = `<svg class="pixel-icon" viewBox="0 0 16 16" shape-rendering="crispEdges">${svg}</svg>`;
  return cache[name];
}

// Циферблат суток 16×16: круг из частей суток (размер сектора — длина части), начало утра — наверху,
// чернильная стрелка идёт по часовой. sectors — [{ id, share }] по порядку, fraction — сколько суток прошло (0..1)
const DIAL_COLORS = { morning: PALETTE.O, day: PALETTE.Y, evening: PALETTE.o, night: PALETTE.n };
export function drawDayDial(canvas, fraction, sectors) {
  canvas.width = canvas.height = 16;
  const g = canvas.getContext('2d');
  const img = g.createImageData(16, 16);
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const ink = hex(PALETTE.k);
  const hand = [Math.sin(fraction * Math.PI * 2), -Math.cos(fraction * Math.PI * 2)];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const r = Math.hypot(dx, dy);
      if (r > 7.6) continue;
      let col;
      // стрелка: близко к отрезку от центра по направлению hand
      const along = dx * hand[0] + dy * hand[1];
      const across = Math.abs(dx * hand[1] - dy * hand[0]);
      if (r > 6.4 || r < 1.2 || (along > 0 && along < 6.2 && across < 0.62)) col = ink;
      else {
        let a = Math.atan2(dx, -dy) / (Math.PI * 2);
        if (a < 0) a += 1;
        let acc = 0;
        const s = sectors.find((sec) => (acc += sec.share) > a) || sectors[sectors.length - 1];
        col = hex(DIAL_COLORS[s.id] || PALETTE.c);
      }
      img.data.set([...col, 255], (y * 16 + x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
}
