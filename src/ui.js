// Интерфейс поверх сцены: кнопка меню, камера, панель инструментов, выбор семян, монеты, магазин, гербарий.
import { plural, formatTime } from './text.js';
import { pixelIcon, drawDayDial } from './icons.js';
import { showLayer, rollingNumber } from './ui-motion.js';

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

// Кнопка панели: значок и цифра клавиши; название — во всплывающей подсказке
function toolButton(key, icon, name) {
  const b = el('button', '', `<span class="key">${key}</span>${pixelIcon(icon)}`);
  b.title = name;
  b.setAttribute('aria-label', name);
  return b;
}

// «1 огонёк», «5 огоньков»
const embersOf = (n) => plural(n, ['огонёк', 'огонька', 'огоньков']);

export function createUI({ onSelectTool, onSelectSeed, onBuy, onUpgrade, onShopToggle, onHerbariumToggle, onTab, plantImage, onCloseUp, onRotate, onMenu }) {
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
  let shopWants = false; // зовёт сам: есть на что потратить монеты
  let shopCalls = 0;     // до какого времени зовёт после события (кончились семена, открылись новые)
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

  // Монеты и огоньки: число прокручивается до нового, значок подпрыгивает (вверх — пришло, вниз — потрачено)
  const coinsBox = el('div', 'hud title', `<span class="coins" title="монеты">${pixelIcon('coin')}<b></b></span><span class="embers" title="огоньки">${pixelIcon('ember')}<b></b></span>`);
  const embersBox = coinsBox.querySelector('.embers');
  const bump = (box) => (dir) => {
    box.classList.remove('up', 'down');
    void box.offsetWidth; // перезапустить анимацию
    box.classList.add(dir);
  };
  const setCoins = rollingNumber(coinsBox.querySelector('.coins b'), bump(coinsBox.querySelector('.coins')));
  const setEmbers = rollingNumber(embersBox.querySelector('b'), bump(embersBox));
  document.body.appendChild(coinsBox);

  // Время суток под монетами: значок, название и полоска — сколько осталось до следующей части
  // Время суток — циферблат: цветные части суток и стрелка, которая по ним идёт
  const daytimeBox = el('div', 'daytime', '<canvas class="daytime-dial"></canvas>');
  const daytimeDial = daytimeBox.querySelector('canvas');
  let shownPhase = null;
  let shownHand = -1;
  document.body.appendChild(daytimeBox);

  // Магазин: две вкладки — семена за монеты и дерево улучшений за огоньки
  let shopTab = 'coins';
  let lastView = null;
  const shop = el('div', 'shop-backdrop');
  shop.innerHTML = `<div class="shop"><div class="shop-head"><span class="title flourished">Магазин</span><button class="shop-close" aria-label="Закрыть">${pixelIcon('close')}</button></div>
    <div class="shop-tabs"><button data-tab="coins" title="семена за монеты">${pixelIcon('coin')}<span class="tab-name">Семена</span></button><button data-tab="embers" title="улучшения за огоньки">${pixelIcon('ember')}<span class="tab-name">Улучшения</span></button></div>
    <div class="shop-list"></div></div>`;
  const shopList = shop.querySelector('.shop-list');
  const tabButtons = shop.querySelectorAll('.shop-tabs button');
  shop.addEventListener('click', (e) => {
    if (e.target === shop || e.target.closest('.shop-close')) onShopToggle(false);
    const tab = e.target.closest('button[data-tab]');
    if (tab && tab.dataset.tab !== shopTab) {
      shopTab = tab.dataset.tab;
      onTab?.(); // перелистнули страницу — звук
      shopList.classList.remove('turn');
      void shopList.offsetWidth;
      shopList.classList.add('turn'); // и лист плавно проявляется заново
      if (lastView) renderShop(lastView);
    }
    const buy = e.target.closest('button[data-buy]');
    if (buy && !buy.disabled) onBuy(buy.dataset.buy, Number(buy.dataset.count));
    const upgrade = e.target.closest('button[data-upgrade]');
    if (upgrade && !upgrade.disabled) onUpgrade(upgrade.dataset.upgrade);
  });
  document.body.appendChild(shop);

  // Семена за монеты
  // Растение в цифрах и значках: растёт, стоит урожай, как бьёт ночью и сколько ночей стоит на страже.
  // Словами — только во всплывающей подсказке при наведении мыши
  const stat = (icon, value, title) => `<span class="stat" title="${title}">${pixelIcon(icon)}${value}</span>`;
  function plantStats(p) {
    const nights = plural(p.nights, ['ночь', 'ночи', 'ночей']);
    return `<div class="stats">
      ${stat('clock', formatTime(p.growSeconds), 'растёт')}
      ${stat('coin', p.sellPrice, `урожай; после ночи на страже — ${p.wiltedPrice}`)}
      ${stat(p.attack.type, p.attack.reach || '', `ночью, если не собрать: ${p.role}`)}
      <span class="stat moons" title="стоит на страже ${nights}, потом засыхает">${pixelIcon('moon').repeat(p.nights)}</span>
    </div>`;
  }
  const plantPicture = (type, locked = false) => `<img class="plant-pic${locked ? ' locked' : ''}" src="${plantImage(type)}" alt="">`;

  // Семена за монеты: картинка, название, сколько есть, значки; закрытые — силуэт и сколько ещё собрать (метки-точки)
  function seedRows(view) {
    return view.shop.map((row) => {
      if (!row.unlocked) {
        const u = row.unlock;
        const pips = Array.from({ length: u.count }, (_, i) => `<i class="${i < u.have ? 'on' : ''}"></i>`).join('');
        return `<div class="shop-row seed-card locked">${plantPicture(row.type, true)}<div class="seed-body">
          <div class="unlock" title="собери ещё — и семена появятся">${plantPicture(u.plant)}<span class="pips">${pips}</span></div></div></div>`;
      }
      const owned = row.seedPrice === 0 ? '∞' : row.owned;
      const buy = (n) => `<button data-buy="${row.type}" data-count="${n}" ${view.coins < row.seedPrice * n ? 'disabled' : ''}>+${n} ${pixelIcon('coin')}${row.seedPrice * n}</button>`;
      return `<div class="shop-row seed-card${row.type === view.selectedSeed ? ' current' : ''}">${plantPicture(row.type)}<div class="seed-body">
        <div class="shop-name"><span class="title">${row.name}</span>${stat('bag', owned, 'семян в мешочке')}</div>
        ${plantStats(row)}
        ${row.seedPrice === 0 ? '' : `<div class="shop-buy">${buy(1)}${buy(5)}</div>`}</div></div>`;
    }).join('');
  }

  // Дерево улучшений: ветка — цепочка шагов сверху вниз; куплено — светится, следующий — с кнопкой, дальше — тускло
  function upgradeRows(view) {
    return view.upgrades.map((branch) => `<div class="shop-section title">${branch.name}</div><div class="tree">${branch.steps.map((step) => {
      const state = step.owned ? 'owned' : step.available ? 'available' : 'locked';
      const price = `${step.price}${pixelIcon('ember')}`;
      const action = step.owned
        ? `<span class="tree-done">${pixelIcon('check')}</span>`
        : step.available
          ? `<button data-upgrade="${step.id}" ${view.embers < step.price ? 'disabled' : ''}>${price}</button>`
          : `<span class="tree-price">${price}</span>`;
      return `<div class="tree-step ${state}" title="${step.about}"><div class="tree-text"><span class="title">${step.name}</span><span class="shop-info">${step.text}</span></div><div class="shop-buy">${action}</div></div>`;
    }).join('')}</div>`).join('');
  }

  function renderShop(view) {
    for (const b of tabButtons) b.classList.toggle('selected', b.dataset.tab === shopTab);
    shopList.innerHTML = shopTab === 'coins' ? seedRows(view) : upgradeRows(view);
  }

  // Гербарий: карточки всех растений; неоткрытые — силуэт и «???»
  const herbarium = el('div', 'shop-backdrop herbarium-backdrop');
  herbarium.innerHTML = `<div class="shop"><div class="shop-head"><span class="title flourished">Гербарий</span><span class="herb-count"></span><button class="shop-close" aria-label="Закрыть">${pixelIcon('close')}</button></div><div class="herb-grid"></div></div>`;
  const herbGrid = herbarium.querySelector('.herb-grid');
  const herbCount = herbarium.querySelector('.herb-count');
  herbarium.addEventListener('click', (e) => {
    if (e.target === herbarium || e.target.closest('.shop-close')) onHerbariumToggle(false);
  });
  document.body.appendChild(herbarium);

  function renderHerbarium(view) {
    const open = view.herbarium.filter((p) => p.open).length;
    herbCount.textContent = `${open} / ${view.herbarium.length}`;
    herbGrid.innerHTML = view.herbarium.map((p) => {
      if (!p.open) return `<div class="herb-card locked">${plantPicture(p.type, true)}<div class="title">???</div></div>`;
      // гибрид: от кого выведен — две маленькие картинки родителей
      const parents = p.parents ? `<div class="parents" title="выведено скрещиванием">${plantPicture(p.parents[0])}+${plantPicture(p.parents[1])}</div>` : '';
      return `<div class="herb-card">${plantPicture(p.type)}<div class="title">${p.name}</div>${parents}${plantStats(p)}
        <div class="stats">${stat('basket', `×${p.harvested}`, 'сколько собрано')}</div></div>`;
    }).join('');
  }


  return {
    // view — всё, что нужно показать: инструмент, монеты, семена, строки магазина
    render(view) {
      for (const [id, b] of Object.entries(toolButtons)) b.classList.toggle('selected', id === view.tool);
      shopButton.classList.toggle('selected', view.shopOpen);
      shopWants = view.shopBeckon;
      shopButton.classList.toggle('beckon', shopWants || shopCalls > performance.now());
      closeUpButton.classList.toggle('on', !!view.closeUp);
      basketCount.textContent = `${view.carried.length}/${view.capacity}`;
      basketCount.classList.toggle('full', view.carried.length >= view.capacity);
      closeUpButton.setAttribute('aria-pressed', String(!!view.closeUp));
      setCoins(view.coins);
      setEmbers(view.embers);
      embersBox.hidden = !view.embers; // огоньки — когда появился первый

      showLayer(seedRow, view.tool === 'seeds');
      seedRow.innerHTML = view.seedOptions
        .map((s) => `<button data-seed="${s.type}" class="${s.type === view.selectedSeed ? 'selected' : ''}" title="${s.name}" aria-label="${s.name}">${plantPicture(s.type)}<b>${s.count}</b></button>`)
        .join('');

      herbariumButton.classList.toggle('on', view.herbariumOpen);
      showLayer(herbarium, view.herbariumOpen);
      if (view.herbariumOpen) renderHerbarium(view);
      lastView = view;
      showLayer(shop, view.shopOpen);
      if (view.shopOpen) renderShop(view); // закрытый магазин не перерисовываем — соберётся заново при открытии
    },

    // phase — { id, name, progress } из daytime.js, fraction — доля суток (0..1), sectors — [{ id, share }] части суток
    setDaytime(phase, fraction, sectors) {
      if (phase.id !== shownPhase) {
        shownPhase = phase.id;
        daytimeBox.title = phase.name; // слово — только в подсказке при наведении
        daytimeBox.dataset.phase = phase.id;
        document.body.dataset.phase = phase.id; // ночью бумага интерфейса чуть темнее (ui.css)
      }
      const hand = Math.round(fraction * 96); // перерисовываем, когда стрелка заметно сдвинулась
      if (hand !== shownHand) {
        shownHand = hand;
        drawDayDial(daytimeDial, fraction, sectors);
      }
    },

    // Магазин зовёт несколько секунд: мерцает кнопка
    beckonShop(ms = 4000) {
      shopCalls = performance.now() + ms;
      shopButton.classList.add('beckon');
      setTimeout(() => shopButton.classList.toggle('beckon', shopWants || shopCalls > performance.now()), ms + 50);
    },

    // Открылись новые семена: мешочек вылетает из точки [x, y] (большая корзина) и летит к кнопке магазина
    flySeedsToShop([x, y]) {
      const bag = el('div', 'fly-seed', pixelIcon('seeds'));
      bag.style.left = `${x - 14}px`;
      bag.style.top = `${y - 14}px`;
      document.body.appendChild(bag);
      const to = shopButton.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bag.style.transform = `translate(${to.left + to.width / 2 - x}px, ${to.top + to.height / 2 - y}px) scale(0.6)`;
        bag.style.opacity = '0.2';
      }));
      setTimeout(() => {
        bag.remove();
        this.beckonShop(6000);
      }, 900);
    },
  };
}
