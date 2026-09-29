// Правила игры: инструменты, семена, монеты, магазин, открытие новых семян.
// Здесь нет графики — только состояние и действия. Картинка узнаёт о переменах через колбэки.
import { PLANTS, BASKET_CELL } from './config.js';
import { isInGarden } from './grid.js';
import { GardenState, EMPTY, RIPE } from './garden.js';

export const TOOL_IDS = ['seeds', 'water', 'hands'];
const PLANT_TYPES = Object.keys(PLANTS);

// «5 морковок», «3 тыквы», «1 гриб»
export function countOf(type, n) {
  const [one, few, many] = PLANTS[type].forms;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const isBasket = (c) => c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;

// onHint(text, ms) — показать подсказку; onEffect(name, cell) — для красоты (брызги, искры);
// onChange() — что-то поменялось: обновить интерфейс и сохранить
export function createGame({ onHint, onEffect, onChange }) {
  const garden = new GardenState();
  const state = {
    tool: 'seeds',
    selectedSeed: 'carrot',
    coins: 0,
    seeds: {},      // запас семян: { radish: 3, ... } (морковь бесплатная, её не считаем)
    harvested: {},  // сколько чего отнесено в корзинку: { carrot: 7, ... }
    held: null,     // что у героя в лапах
    shopOpen: false,
  };

  const isFree = (type) => PLANTS[type].seedPrice === 0;
  const seedCount = (type) => (isFree(type) ? Infinity : state.seeds[type] || 0);
  const isUnlocked = (type) => {
    const unlock = PLANTS[type].unlock;
    return !unlock || (state.harvested[unlock.plant] || 0) >= unlock.count;
  };

  function changed() {
    if (seedCount(state.selectedSeed) <= 0 || !isUnlocked(state.selectedSeed)) state.selectedSeed = 'carrot';
    onChange();
  }

  function applyTool(c) {
    if (isBasket(c)) return putInBasket();
    if (!isInGarden(c)) return;
    const stage = garden.stage(c);

    if (state.tool === 'seeds') {
      if (stage !== EMPTY) return onHint('Здесь уже посажено');
      garden.plant(c, state.selectedSeed);
      if (!isFree(state.selectedSeed)) state.seeds[state.selectedSeed]--;
      onEffect('planted', c);
    } else if (state.tool === 'water') {
      if (stage === EMPTY) return onHint('Сначала посади семена');
      if (garden.isWatered(c)) return onHint('Уже полито — растёт');
      garden.water(c);
      onEffect('watered', c);
    } else if (state.tool === 'hands') {
      if (stage === EMPTY) return onHint('Здесь пусто');
      if (stage !== RIPE) return onHint(garden.isWatered(c) ? 'Ещё растёт' : 'Сначала полей');
      if (state.held) return onHint('Лапы заняты — отнеси урожай в корзинку');
      state.held = garden.harvest(c);
      onEffect('harvested', c);
    }
  }

  // Корзинка превращает урожай в монеты
  function putInBasket() {
    const type = state.held;
    if (!type) return onHint('Лапы пусты — сначала собери урожай');
    const lockedBefore = PLANT_TYPES.filter((t) => !isUnlocked(t));

    state.held = null;
    state.coins += PLANTS[type].sellPrice;
    state.harvested[type] = (state.harvested[type] || 0) + 1;
    onEffect('sold', BASKET_CELL);

    const opened = lockedBefore.filter(isUnlocked);
    if (opened.length) onEffect('unlocked', BASKET_CELL);
    if (opened.length) onHint(`Новые семена в магазине: ${opened.map((t) => PLANTS[t].name).join(', ')}!`, 3500);
    else onHint(`+${PLANTS[type].sellPrice} мон.`);
  }

  return {
    garden,
    state,

    // Выбранный инструмент срабатывает на клетке (или на корзинке)
    useTool(c) {
      applyTool(c);
      changed();
    },
    selectTool(id) {
      if (TOOL_IDS.includes(id)) state.tool = id;
      changed();
    },
    selectSeed(type) {
      state.selectedSeed = type;
      changed();
    },
    toggleShop(open = !state.shopOpen) {
      state.shopOpen = open;
      changed();
    },
    buySeeds(type, count) {
      const cost = PLANTS[type].seedPrice * count;
      if (!isUnlocked(type) || state.coins < cost) return;
      state.coins -= cost;
      state.seeds[type] = (state.seeds[type] || 0) + count;
      state.selectedSeed = type; // сразу готовы сажать купленное
      changed();
    },
    addCoins(n) {
      state.coins += n;
      changed();
    },

    // ---------- Ночь: духи уносят добро (решает night.js) ----------
    // Спелые грядки — куда могут прийти духи
    ripeCells() {
      return garden.cells.filter((cell) => garden.stage(cell) === RIPE).map(({ x, z }) => ({ x, z }));
    },
    // Унести спелый урожай с грядки. Возвращает, что унесли, или null (уже собрали)
    stealCrop(c) {
      if (garden.stage(c) !== RIPE) return null;
      const type = garden.harvest(c);
      changed();
      return type;
    },
    // Унести монеты из корзинки (сколько — решает night.js). Возвращает, сколько унесли
    stealCoins(amount) {
      const taken = Math.min(state.coins, Math.max(0, Math.floor(amount)));
      state.coins -= taken;
      if (taken) changed();
      return taken;
    },

    // Всё, что нужно показать в интерфейсе
    view() {
      return {
        tool: state.tool,
        coins: state.coins,
        shopOpen: state.shopOpen,
        selectedSeed: state.selectedSeed,
        seedOptions: PLANT_TYPES
          .filter((type) => isUnlocked(type) && seedCount(type) > 0)
          .map((type) => ({ type, name: PLANTS[type].name, count: isFree(type) ? '∞' : seedCount(type) })),
        shop: PLANT_TYPES.map((type) => {
          const p = PLANTS[type];
          const unlock = p.unlock;
          return {
            type,
            name: p.name,
            unlocked: isUnlocked(type),
            seedPrice: p.seedPrice,
            sellPrice: p.sellPrice,
            growSeconds: p.stageSeconds * 3,
            owned: seedCount(type),
            condition: unlock && `собери ${countOf(unlock.plant, unlock.count)} (есть ${state.harvested[unlock.plant] || 0})`,
          };
        }),
      };
    },

    hasHarvest: () => Object.values(state.harvested).some((n) => n > 0),

    // Для сохранения (позицию героя добавляет main.js)
    toSave() {
      const { coins, seeds, harvested, held, tool, selectedSeed } = state;
      return { cells: garden.toSave(), coins, seeds, harvested, held, tool, selectedSeed };
    },
    load(saved) {
      garden.load(saved.cells || []);
      state.coins = saved.coins || 0;
      state.seeds = saved.seeds || {};
      state.harvested = saved.harvested || {};
      if (TOOL_IDS.includes(saved.tool)) state.tool = saved.tool;
      if (PLANTS[saved.selectedSeed]) state.selectedSeed = saved.selectedSeed;
      if (PLANTS[saved.held]) state.held = saved.held;
    },
  };
}
