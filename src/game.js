// Правила игры: инструменты, семена, монеты, магазин, открытие новых семян.
// Здесь нет графики — только состояние и действия. Картинка узнаёт о переменах через колбэки.
import { PLANTS, BASKET_CELL, HAND_BASKET, GROWTH_SPEED } from './config.js';
import { isInGarden } from './grid.js';
import { GardenState, EMPTY, RIPE } from './garden.js';
import { plural } from './text.js';

export const TOOL_IDS = ['seeds', 'water', 'basket'];
const PLANT_TYPES = Object.keys(PLANTS);

// «5 морковок», «3 тыквы», «1 гриб»
export const countOf = (type, n) => plural(n, PLANTS[type].forms);

export const isBasket = (c) => c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;

// onHint(text, ms) — показать подсказку; onEffect(name, cell, earned) — для красоты (брызги, искры; earned — выручка при продаже);
// onChange() — что-то поменялось: обновить интерфейс и сохранить
export function createGame({ onHint, onEffect, onChange }) {
  const garden = new GardenState();
  const state = {
    tool: 'seeds',
    selectedSeed: 'carrot',
    coins: 0,
    seeds: {},      // запас семян: { radish: 3, ... } (морковь бесплатная, её не считаем)
    harvested: {},  // сколько чего отнесено в корзинку: { carrot: 7, ... }
    carried: [],    // что собрано в корзинку для сбора: ['carrot', 'radish']
    basketLevel: 0, // сколько раз корзинку улучшили в магазине
    embers: 0,      // огоньки — от прогнанных ночью духов
    shopOpen: false,
  };

  const isFree = (type) => PLANTS[type].seedPrice === 0;
  const seedCount = (type) => (isFree(type) ? Infinity : state.seeds[type] || 0);
  const isUnlocked = (type) => {
    const unlock = PLANTS[type].unlock;
    return !unlock || (state.harvested[unlock.plant] || 0) >= unlock.count;
  };

  // Сколько помещается в корзинку для сбора, и какое улучшение следующее (или null — больше нет)
  const capacity = () => HAND_BASKET[state.basketLevel].capacity;
  const nextUpgrade = () => HAND_BASKET[state.basketLevel + 1] || null;

  // Выбранные семена кончились или ещё не открыты — берём бесплатные
  function checkSelectedSeed() {
    if (seedCount(state.selectedSeed) <= 0 || !isUnlocked(state.selectedSeed)) state.selectedSeed = 'carrot';
  }

  function changed() {
    checkSelectedSeed();
    onChange();
  }

  function applyTool(c) {
    if (isBasket(c)) return putInBasket();
    if (!isInGarden(c)) return;
    const stage = garden.stage(c);

    if (state.tool === 'seeds') {
      if (stage !== EMPTY) return onHint('Здесь уже посажено');
      if (seedCount(state.selectedSeed) <= 0) return onHint('Семена кончились — купи в магазине');
      garden.plant(c, state.selectedSeed);
      if (!isFree(state.selectedSeed)) state.seeds[state.selectedSeed]--;
      onEffect('planted', c);
    } else if (state.tool === 'water') {
      if (stage === EMPTY) return onHint('Сначала посади семена');
      if (garden.isWatered(c)) return onHint('Уже полито — растёт');
      garden.water(c);
      onEffect('watered', c);
    } else if (state.tool === 'basket') {
      if (stage === EMPTY) return onHint('Здесь пусто');
      if (stage !== RIPE) return onHint(garden.isWatered(c) ? 'Ещё растёт' : 'Сначала полей');
      if (state.carried.length >= capacity()) return onHint('Корзинка полна — отнеси урожай к большой корзине у дома');
      state.carried.push(garden.harvest(c));
      onEffect('harvested', c);
    }
  }

  // Большая корзина у дома превращает урожай в монеты: всё из корзинки для сбора — разом
  function putInBasket() {
    if (!state.carried.length) return onHint('Корзинка пуста — сначала собери урожай');
    const lockedBefore = PLANT_TYPES.filter((t) => !isUnlocked(t));

    let earned = 0;
    for (const type of state.carried) {
      earned += PLANTS[type].sellPrice;
      state.harvested[type] = (state.harvested[type] || 0) + 1;
    }
    state.carried = [];
    state.coins += earned;
    onEffect('sold', BASKET_CELL, earned);

    const opened = lockedBefore.filter(isUnlocked);
    if (opened.length) onEffect('unlocked', BASKET_CELL);
    if (opened.length) onHint(`Новые семена в магазине: ${opened.map((t) => PLANTS[t].name).join(', ')}!`, 3500);
    else onHint(`+${earned} мон.`);
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
      if (!isUnlocked(type) || state.coins < cost) return false;
      state.coins -= cost;
      state.seeds[type] = (state.seeds[type] || 0) + count;
      state.selectedSeed = type; // сразу готовы сажать купленное
      changed();
      return true;
    },
    // Улучшить корзинку для сбора (магазин)
    upgradeBasket() {
      const next = nextUpgrade();
      if (!next || state.coins < next.price) return false;
      state.coins -= next.price;
      state.basketLevel++;
      changed();
      return true;
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
    // Дух испугался и уронил добычу: урожай — обратно на грядку спелым. Если грядку уже заняли —
    // в корзинку для сбора, а если и она полна — засчитываем как проданный. Монеты — в большую корзину
    returnCrop(c, type, nights) {
      if (!garden.putBackRipe(c, type, nights)) {
        if (state.carried.length < capacity()) state.carried.push(type);
        else {
          state.coins += PLANTS[type].sellPrice;
          state.harvested[type] = (state.harvested[type] || 0) + 1;
        }
      }
      changed();
      return true;
    },
    returnCoins(n) {
      state.coins += n;
      changed();
    },
    addEmbers(n) {
      state.embers += n;
      changed();
    },

    // Утро: каждое спелое растение отслужило ещё одну ночь. Кто отслужил своё — отцветает и оставляет семена.
    // Возвращает, что отцвело: [{ type, seeds }]
    endOfNight() {
      const faded = [];
      for (const cell of garden.cells) {
        if (garden.stage(cell) !== RIPE) continue;
        cell.nights = (cell.nights || 0) + 1;
        const d = PLANTS[cell.plant].defense;
        if (cell.nights < d.nights) continue;
        const type = garden.harvest(cell);
        const [min, max] = d.seeds;
        const seeds = isFree(type) ? 0 : min + Math.floor(Math.random() * (max - min + 1));
        if (seeds) state.seeds[type] = (state.seeds[type] || 0) + seeds;
        faded.push({ type, seeds });
      }
      changed();
      return faded;
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
        embers: state.embers,
        shopOpen: state.shopOpen,
        carried: state.carried,
        capacity: capacity(),
        basketUpgrade: nextUpgrade(),
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
            defense: p.defense,
            sellPrice: p.sellPrice,
            growSeconds: (p.stageSeconds * RIPE) / GROWTH_SPEED,
            owned: seedCount(type),
            condition: unlock && `собери ${countOf(unlock.plant, unlock.count)} (есть ${state.harvested[unlock.plant] || 0})`,
          };
        }),
      };
    },

    hasHarvest: () => Object.values(state.harvested).some((n) => n > 0),

    // Для сохранения (позицию героя добавляет main.js)
    toSave() {
      const { coins, embers, seeds, harvested, carried, basketLevel, tool, selectedSeed } = state;
      return { cells: garden.toSave(), coins, embers, seeds, harvested, carried, basketLevel, tool, selectedSeed };
    },
    load(saved) {
      // файл могли поправить руками — все числа приводим к целым неотрицательным
      const count = (n) => Math.max(0, Math.floor(Number(n)) || 0);
      const counts = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([t]) => PLANTS[t]).map(([t, n]) => [t, count(n)]));
      garden.load(Array.isArray(saved.cells) ? saved.cells : []);
      state.coins = count(saved.coins);
      state.embers = count(saved.embers);
      state.seeds = counts(saved.seeds);
      state.harvested = counts(saved.harvested);
      state.basketLevel = Math.min(count(saved.basketLevel), HAND_BASKET.length - 1);
      if (TOOL_IDS.includes(saved.tool)) state.tool = saved.tool;
      if (PLANTS[saved.selectedSeed]) state.selectedSeed = saved.selectedSeed;
      checkSelectedSeed();
      state.carried = (Array.isArray(saved.carried) ? saved.carried : []).filter((t) => PLANTS[t]).slice(0, capacity());
    },
  };
}
