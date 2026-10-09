// Интерфейс поверх сцены: кнопка меню, камера, панель инструментов, выбор семян, монеты, магазин, подсказки.
import { plural, formatTime } from './text.js';

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
  basket: [
    '............',
    '....####....',
    '...#....#...',
    '..#......#..',
    '.#........#.',
    '############',
    '############',
    '.#.##.##.#..',
    '.##########.',
    '.#.##.##.##.',
    '..########..',
    '............',
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
  // книга — гербарий
  book: [
    '............',
    '.####..####.',
    '#....##....#',
    '#.##.##.##.#',
    '#....##....#',
    '#.##.##.##.#',
    '#....##....#',
    '#.##.##.##.#',
    '#....##....#',
    '.####..####.',
    '.....##.....',
    '............',
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
  { id: 'basket', name: 'Корзинка' },
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

// «1 огонёк», «5 огоньков»
const embersOf = (n) => plural(n, ['огонёк', 'огонька', 'огоньков']);

export function createUI({ onSelectTool, onSelectSeed, onBuy, onUpgrade, onShopToggle, onHerbariumToggle, plantImage, onCloseUp, onRotate, onMenu }) {
  // Меню в левом верхнем углу (Esc): сохранение, новая игра, звук и музыка
  const menuBar = el('div', 'corner-bar');
  const menuButton = el('button', '', `${pixelIcon('menu')}<span class="key">Esc</span>`);
  menuButton.title = 'Меню';
  menuButton.setAttribute('aria-label', 'Меню');
  menuButton.addEventListener('click', () => onMenu());
  menuBar.appendChild(menuButton);
  // Гербарий (H) — рядом с меню
  const herbariumButton = el('button', '', `${pixelIcon('book')}<span class="key">H</span>`);
  herbariumButton.title = 'Гербарий';
  herbariumButton.setAttribute('aria-label', 'Гербарий');
  herbariumButton.addEventListener('click', () => onHerbariumToggle());
  menuBar.appendChild(herbariumButton);
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
  // на корзинке — сколько собрано и сколько помещается: «1/2»
  const basketCount = el('span', 'count');
  toolButtons.basket.appendChild(basketCount);
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

  // Магазин: две вкладки — семена за монеты и дерево улучшений за огоньки
  let shopTab = 'coins';
  let lastView = null;
  const shop = el('div', 'shop-backdrop');
  shop.innerHTML = `<div class="shop"><div class="shop-head"><span class="title">Магазин</span><button class="shop-close" aria-label="Закрыть">✕</button></div>
    <div class="shop-tabs"><button data-tab="coins" class="title">За монеты</button><button data-tab="embers" class="title">За огоньки</button></div>
    <div class="shop-list"></div></div>`;
  const shopList = shop.querySelector('.shop-list');
  const tabButtons = shop.querySelectorAll('.shop-tabs button');
  shop.addEventListener('click', (e) => {
    if (e.target === shop || e.target.closest('.shop-close')) onShopToggle(false);
    const tab = e.target.closest('button[data-tab]');
    if (tab && tab.dataset.tab !== shopTab) {
      shopTab = tab.dataset.tab;
      if (lastView) renderShop(lastView);
    }
    const buy = e.target.closest('button[data-buy]');
    if (buy && !buy.disabled) onBuy(buy.dataset.buy, Number(buy.dataset.count));
    const upgrade = e.target.closest('button[data-upgrade]');
    if (upgrade && !upgrade.disabled) onUpgrade(upgrade.dataset.upgrade);
  });
  document.body.appendChild(shop);

  // Семена за монеты
  function seedRows(view) {
    return view.shop.map((row) => {
      if (!row.unlocked) {
        return `<div class="shop-row locked"><div class="shop-name"><span class="title">???</span></div><div class="shop-info">Откроется: ${row.condition}</div></div>`;
      }
      const info = `рост ${formatTime(row.growSeconds)} · урожай ${row.sellPrice} мон.`;
      const d = row.defense;
      const guard = `<div class="shop-info guard">ночью, если не собрать: ${d.role} · служит ${plural(d.nights, ['ночь', 'ночи', 'ночей'])}, потом засыхает · после ночи на страже урожай ${row.wiltedPrice} мон.</div>`;
      if (row.seedPrice === 0) {
        return `<div class="shop-row"><div class="shop-name"><span class="title">${row.name}</span></div><div class="shop-info">${info}</div>${guard}<div class="shop-info">семена бесплатно, сколько угодно</div></div>`;
      }
      const buyButton = (n) => `<button data-buy="${row.type}" data-count="${n}" ${view.coins < row.seedPrice * n ? 'disabled' : ''}>+${n} за ${row.seedPrice * n}</button>`;
      return `<div class="shop-row"><div class="shop-name"><span class="title">${row.name}</span><span class="owned">у тебя: ${row.owned}</span></div><div class="shop-info">${info}</div>${guard}<div class="shop-buy">${buyButton(1)}${buyButton(5)}</div></div>`;
    }).join('');
  }

  // Дерево улучшений: ветка — цепочка шагов сверху вниз; куплено — светится, следующий — с кнопкой, дальше — тускло
  function upgradeRows(view) {
    const head = `<div class="shop-info tree-note">Огоньки остаются от прогнанных ночью духов. У тебя: <b>${view.embers}</b></div>`;
    return head + view.upgrades.map((branch) => `<div class="shop-section title">${branch.name}</div><div class="tree">${branch.steps.map((step) => {
      const state = step.owned ? 'owned' : step.available ? 'available' : 'locked';
      const action = step.owned
        ? '<span class="tree-done">есть</span>'
        : step.available
          ? `<button data-upgrade="${step.id}" ${view.embers < step.price ? 'disabled' : ''}>за ${embersOf(step.price)}</button>`
          : `<span class="tree-price">${embersOf(step.price)}</span>`;
      return `<div class="tree-step ${state}"><div class="tree-text"><span class="title">${step.name}</span><span class="shop-info">${step.text}</span></div><div class="shop-buy">${action}</div></div>`;
    }).join('')}</div>`).join('');
  }

  function renderShop(view) {
    for (const b of tabButtons) b.classList.toggle('selected', b.dataset.tab === shopTab);
    shopList.innerHTML = shopTab === 'coins' ? '<div class="shop-section title">Семена</div>' + seedRows(view) : upgradeRows(view);
  }

  // Гербарий: карточки всех растений; неоткрытые — силуэт и «???»
  const herbarium = el('div', 'shop-backdrop herbarium-backdrop');
  herbarium.innerHTML = '<div class="shop"><div class="shop-head"><span class="title">Гербарий</span><span class="herb-count"></span><button class="shop-close" aria-label="Закрыть">✕</button></div><div class="herb-grid"></div></div>';
  const herbGrid = herbarium.querySelector('.herb-grid');
  const herbCount = herbarium.querySelector('.herb-count');
  herbarium.addEventListener('click', (e) => {
    if (e.target === herbarium || e.target.closest('.shop-close')) onHerbariumToggle(false);
  });
  document.body.appendChild(herbarium);

  function renderHerbarium(view) {
    const open = view.herbarium.filter((p) => p.open).length;
    herbCount.textContent = `открыто ${open} из ${view.herbarium.length}`;
    herbGrid.innerHTML = view.herbarium.map((p) => {
      const img = `<img src="${plantImage(p.type)}" alt="">`;
      if (!p.open) return `<div class="herb-card locked">${img}<div class="title">???</div></div>`;
      const rows = [
        p.parents && `выведено из: ${p.parents.join(' и ')}`,
        `рост ${formatTime(p.growSeconds)} · урожай ${p.sellPrice} мон.`,
        `собрано: ${p.harvested}`,
      ].filter(Boolean).map((r) => `<div class="shop-info">${r}</div>`).join('');
      return `<div class="herb-card">${img}<div class="title">${p.name}</div>${rows}<div class="shop-info guard">${p.role}</div></div>`;
    }).join('');
  }

  const hintBox = el('div', 'hint');
  document.body.appendChild(hintBox);
  let hintTimer;

  return {
    // view — всё, что нужно показать: инструмент, монеты, семена, строки магазина
    render(view) {
      for (const [id, b] of Object.entries(toolButtons)) b.classList.toggle('selected', id === view.tool);
      shopButton.classList.toggle('selected', view.shopOpen);
      closeUpButton.classList.toggle('on', !!view.closeUp);
      basketCount.textContent = `${view.carried.length}/${view.capacity}`;
      basketCount.classList.toggle('full', view.carried.length >= view.capacity);
      closeUpButton.setAttribute('aria-pressed', String(!!view.closeUp));
      coinsBox.innerHTML = `Монеты: ${view.coins}${view.embers ? `<span class="embers">Огоньки: ${view.embers}</span>` : ''}`;

      seedRow.classList.toggle('visible', view.tool === 'seeds');
      seedRow.innerHTML = view.seedOptions
        .map((s) => `<button data-seed="${s.type}" class="${s.type === view.selectedSeed ? 'selected' : ''}">${s.name} <b>${s.count}</b></button>`)
        .join('');

      herbariumButton.classList.toggle('on', view.herbariumOpen);
      herbarium.classList.toggle('visible', view.herbariumOpen);
      if (view.herbariumOpen) renderHerbarium(view);
      lastView = view;
      shop.classList.toggle('visible', view.shopOpen);
      if (view.shopOpen) renderShop(view); // закрытый магазин не перерисовываем — соберётся заново при открытии
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
