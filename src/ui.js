// Интерфейс поверх сцены: кнопка меню, камера, панель инструментов, выбор семян, монеты, магазин, подсказки.

// Пиксельные значки 12×12: «#» — закрашенный пиксель, «.» — пусто
const PIXEL_ICONS = {
  seeds: [
    '............',
    '.##......##.',
    '.###....###.',
    '..###..###..',
    '...##..##...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '..########..',
    '.##########.',
    '............',
  ],
  water: [
    '............',
    '...####.....',
    '..#....#....',
    '..#....#...#',
    '.########.##',
    '.#########..',
    '.########...',
    '.########...',
    '.########...',
    '.########...',
    '..######....',
    '............',
  ],
  hands: [
    '.....#......',
    '...#.#.#....',
    '...#.#.#.#..',
    '...#.#.#.#..',
    '...#.#.#.#..',
    '...#######..',
    '#..#######..',
    '##.#######..',
    '.#########..',
    '..########..',
    '...######...',
    '....####....',
  ],
  shop: [
    '............',
    '.##########.',
    '############',
    '#.##.##.##.#',
    '.#..#..#..#.',
    '.#........#.',
    '.#.###.##.#.',
    '.#.#.#.##.#.',
    '.#.#.#....#.',
    '.#.#.#....#.',
    '############',
    '............',
  ],
  // меню: три полоски
  menu: [
    '............',
    '............',
    '.##########.',
    '.##########.',
    '............',
    '.##########.',
    '.##########.',
    '............',
    '.##########.',
    '.##########.',
    '............',
    '............',
  ],
  // время суток: солнце (день), половинка солнца над горизонтом (утро и вечер), месяц (ночь)
  sun: [
    '.....##.....',
    '.#...##...#.',
    '..#......#..',
    '....####....',
    '...######...',
    '##.######.##',
    '##.######.##',
    '...######...',
    '....####....',
    '..#......#..',
    '.#...##...#.',
    '.....##.....',
  ],
  sunrise: [
    '............',
    '............',
    '.....##.....',
    '.#...##...#.',
    '..#......#..',
    '....####....',
    '...######...',
    '.#.######.#.',
    '............',
    '############',
    '............',
    '..########..',
  ],
  moon: [
    '............',
    '....####....',
    '...###......',
    '..###.......',
    '.####.......',
    '.####.......',
    '.####.......',
    '.#####....#.',
    '..######.##.',
    '...#######..',
    '....####....',
    '............',
  ],
  // лупа — крупный план
  zoom: [
    '............',
    '...####.....',
    '..#....#....',
    '.#..##..#...',
    '.#.####.#...',
    '.#.####.#...',
    '.#..##..#...',
    '..#....#....',
    '...####.#...',
    '........##..',
    '.........##.',
    '..........##',
  ],
  // круговая стрелка по часовой — повернуть мир вправо
  rotateRight: [
    '............',
    '....####....',
    '..##....#...',
    '.#.......#..',
    '.#.....#####',
    '.#......###.',
    '.#.......#..',
    '.#..........',
    '..#.........',
    '...##.......',
    '.....###....',
    '............',
  ],
};
// против часовой — то же зеркально
PIXEL_ICONS.rotateLeft = PIXEL_ICONS.rotateRight.map((row) => [...row].reverse().join(''));

// Рисуем значок квадратиками без сглаживания, цвет берётся у кнопки
function pixelIcon(name) {
  const rects = [];
  PIXEL_ICONS[name].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    });
  });
  return `<svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

// Инструменты (клавиши 1–3). Магазин — клавиша 4, это не инструмент, а окно.
export const TOOLS = [
  { id: 'seeds', name: 'Семена' },
  { id: 'water', name: 'Лейка' },
  { id: 'hands', name: 'Руки' },
];

function el(tag, className, html = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  e.innerHTML = html;
  return e;
}

function toolButton(key, icon, name) {
  return el('button', '', `
    <span class="key">${key}</span>
    ${pixelIcon(icon)}
    <span class="name title">${name}</span>`);
}

// «1 мин», «1,5 мин», «45 с»
function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)} с`;
  return `${String(Math.round((seconds / 60) * 10) / 10).replace('.', ',')} мин`;
}

export function createUI({ onSelectTool, onSelectSeed, onBuy, onShopToggle, onCloseUp, onRotate, onMenu }) {
  // Меню в левом верхнем углу (Esc): сохранение, новая игра, звук и музыка
  const menuBar = el('div', 'corner-bar');
  const menuButton = el('button', '', `${pixelIcon('menu')}<span class="key">Esc</span>`);
  menuButton.title = 'Меню';
  menuButton.setAttribute('aria-label', 'Меню');
  menuButton.addEventListener('click', () => onMenu());
  menuBar.appendChild(menuButton);
  document.body.appendChild(menuBar);

  // Кнопки камеры под меню: повернуть мир влево (Q), крупный план (Z), повернуть вправо (E)
  const viewBar = el('div', 'corner-bar view-bar');
  const viewButton = (icon, key, label, onClick) => {
    const b = el('button', '', `${pixelIcon(icon)}<span class="key">${key}</span>`);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    viewBar.appendChild(b);
    return b;
  };
  viewButton('rotateLeft', 'Q', 'Повернуть мир влево', () => onRotate(-1));
  const closeUpButton = viewButton('zoom', 'Z', 'Крупный план', () => onCloseUp());
  viewButton('rotateRight', 'E', 'Повернуть мир вправо', () => onRotate(1));
  document.body.appendChild(viewBar);

  // Панель инструментов
  const toolbar = el('div', 'toolbar');
  const toolButtons = {};
  TOOLS.forEach((tool, i) => {
    const b = toolButton(i + 1, tool.id, tool.name);
    b.addEventListener('click', () => onSelectTool(tool.id));
    toolbar.appendChild(b);
    toolButtons[tool.id] = b;
  });
  const shopButton = toolButton(4, 'shop', 'Магазин');
  shopButton.addEventListener('click', () => onShopToggle());
  toolbar.appendChild(shopButton);
  document.body.appendChild(toolbar);

  // Ряд семян над панелью (виден, когда выбраны «Семена»)
  const seedRow = el('div', 'seed-row');
  seedRow.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-seed]');
    if (b) onSelectSeed(b.dataset.seed);
  });
  document.body.appendChild(seedRow);

  const coinsBox = el('div', 'hud title');
  document.body.appendChild(coinsBox);

  // Время суток под монетами: значок, название и полоска — сколько осталось до следующей части
  const DAYTIME_ICONS = { morning: 'sunrise', day: 'sun', evening: 'sunrise', night: 'moon' };
  const daytimeBox = el('div', 'daytime', '<span class="daytime-icon"></span><span class="daytime-name title"></span><span class="daytime-bar"><i></i></span>');
  const daytimeIcon = daytimeBox.querySelector('.daytime-icon');
  const daytimeName = daytimeBox.querySelector('.daytime-name');
  const daytimeFill = daytimeBox.querySelector('.daytime-bar i');
  let shownPhase = null;
  document.body.appendChild(daytimeBox);

  // Магазин
  const shop = el('div', 'shop-backdrop');
  shop.innerHTML = '<div class="shop"><div class="shop-head"><span class="title">Магазин семян</span><button class="shop-close" aria-label="Закрыть">✕</button></div><div class="shop-list"></div></div>';
  const shopList = shop.querySelector('.shop-list');
  shop.addEventListener('click', (e) => {
    if (e.target === shop || e.target.closest('.shop-close')) onShopToggle(false);
    const buy = e.target.closest('button[data-buy]');
    if (buy && !buy.disabled) onBuy(buy.dataset.buy, Number(buy.dataset.count));
  });
  document.body.appendChild(shop);

  const hintBox = el('div', 'hint');
  document.body.appendChild(hintBox);
  let hintTimer;

  return {
    // view — всё, что нужно показать: инструмент, монеты, семена, строки магазина
    render(view) {
      for (const [id, b] of Object.entries(toolButtons)) b.classList.toggle('selected', id === view.tool);
      shopButton.classList.toggle('selected', view.shopOpen);
      closeUpButton.classList.toggle('on', !!view.closeUp);
      closeUpButton.setAttribute('aria-pressed', String(!!view.closeUp));
      coinsBox.innerHTML = `Монеты: ${view.coins}${view.embers ? `<span class="embers">Огоньки: ${view.embers}</span>` : ''}`;

      seedRow.classList.toggle('visible', view.tool === 'seeds');
      seedRow.innerHTML = view.seedOptions
        .map((s) => `<button data-seed="${s.type}" class="${s.type === view.selectedSeed ? 'selected' : ''}">${s.name} <b>${s.count}</b></button>`)
        .join('');

      shop.classList.toggle('visible', view.shopOpen);
      shopList.innerHTML = view.shop.map((row) => {
        if (!row.unlocked) {
          return `<div class="shop-row locked"><div class="shop-name"><span class="title">???</span></div><div class="shop-info">Откроется: ${row.condition}</div></div>`;
        }
        const info = `рост ${formatTime(row.growSeconds)} · урожай ${row.sellPrice} мон.`;
        if (row.seedPrice === 0) {
          return `<div class="shop-row"><div class="shop-name"><span class="title">${row.name}</span></div><div class="shop-info">${info}</div><div class="shop-info">семена бесплатно, сколько угодно</div></div>`;
        }
        const buyButton = (n) => `<button data-buy="${row.type}" data-count="${n}" ${view.coins < row.seedPrice * n ? 'disabled' : ''}>+${n} за ${row.seedPrice * n}</button>`;
        return `<div class="shop-row"><div class="shop-name"><span class="title">${row.name}</span><span class="owned">у тебя: ${row.owned}</span></div><div class="shop-info">${info}</div><div class="shop-buy">${buyButton(1)}${buyButton(5)}</div></div>`;
      }).join('');
    },

    // phase — { id, name, progress } из daytime.js
    setDaytime(phase) {
      if (phase.id !== shownPhase) {
        shownPhase = phase.id;
        daytimeIcon.innerHTML = pixelIcon(DAYTIME_ICONS[phase.id] || 'sun');
        daytimeName.textContent = phase.name;
        daytimeBox.dataset.phase = phase.id;
      }
      daytimeFill.style.width = `${Math.round((1 - phase.progress) * 100)}%`;
    },

    hint(text, ms = 1600) {
      hintBox.textContent = text;
      hintBox.classList.add('visible');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hintBox.classList.remove('visible'), ms);
    },
  };
}
