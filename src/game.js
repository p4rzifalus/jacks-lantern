// Правила игры: инструменты, семена, монеты, магазин, открытие новых семян.
// Здесь нет графики — только состояние и действия. Картинка узнаёт о переменах через колбэки.
import { PLANTS, BASKET_CELL, HAND_BASKET, GROWTH_SPEED, WILTED_SELL_SHARE, WEATHER, CROSSING } from './config.js';
import { isInGarden } from './grid.js';
import { GardenState, EMPTY, RIPE } from './garden.js';
import { plural } from './text.js';

export const TOOL_IDS = ['seeds', 'water', 'basket'];
const PLANT_TYPES = Object.keys(PLANTS);
const isHybrid = (type) => !!PLANTS[type].hybrid;
const HYBRIDS = PLANT_TYPES.filter(isHybrid);
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// «5 морковок», «3 тыквы», «1 гриб»
export const countOf = (type, n) => plural(n, PLANTS[type].forms);

export const isBasket = (c) => c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;

// Цена урожая: вялый (отстоял ночь на страже) — дешевле
const priceOf = ({ type, wilted }) => (wilted ? Math.ceil(PLANTS[type].sellPrice * WILTED_SELL_SHARE) : PLANTS[type].sellPrice);

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
    carried: [],    // что собрано в корзинку для сбора: [{ type: 'carrot', wilted: false }, ...] (wilted — отстоял ночь на страже)
    basketLevel: 0, // сколько раз корзинку улучшили в магазине
    embers: 0,      // огоньки — от прогнанных ночью духов
    discovered: [], // какие гибриды уже выведены (их семена — только скрещиванием)
    nightsSeen: 0,  // сколько ночей уже прошло (от этого — сколько духов приходит, config.js → NIGHTS)
    shopOpen: false,
  };

  const isFree = (type) => PLANTS[type].seedPrice === 0;
  const seedCount = (type) => (isFree(type) ? Infinity : state.seeds[type] || 0);
  const isUnlocked = (type) => {
    if (isHybrid(type)) return state.discovered.includes(type);
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

  // Скрещивание: какой гибрид может получиться при сборе растения type с клетки c — от спелых соседей подходящего вида
  // (null — не повезло или пары рядом нет). Если подходящих соседей несколько — один из них наугад
  function crossSeed(c, type) {
    const options = [];
    for (const [dx, dz] of NEIGHBORS) {
      const n = { x: c.x + dx, z: c.z + dz };
      if (!isInGarden(n) || garden.stage(n) !== RIPE) continue;
      const other = garden.cell(n).plant;
      for (const h of HYBRIDS) {
        const [a, b] = PLANTS[h].hybrid;
        if ((a === type && b === other) || (b === type && a === other)) options.push(h);
      }
    }
    if (!options.length || Math.random() >= CROSSING.chance) return null;
    return options[Math.floor(Math.random() * options.length)];
  }

  let rainCarry = 0; // доли грядки, которые дождь «намочил» между кадрами

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
      if (garden.isWet(c)) return onHint(stage === EMPTY ? 'Уже полито — можно сажать' : 'Уже полито — растёт');
      garden.water(c);
      onEffect('watered', c);
    } else if (state.tool === 'basket') {
      if (stage === EMPTY) return onHint('Здесь пусто');
      if (stage !== RIPE) return onHint(garden.isWet(c) ? 'Ещё растёт' : 'Сначала полей');
      if (state.carried.length >= capacity()) return onHint('Корзинка полна — отнеси урожай к большой корзине в центре огорода');
      const cell = garden.cell(c);
      const wilted = cell.nights > 0;
      const hybrid = crossSeed(c, cell.plant);
      state.carried.push({ type: garden.harvest(c), wilted });
      onEffect('harvested', c);
      if (hybrid) {
        const first = !state.discovered.includes(hybrid);
        if (first) state.discovered.push(hybrid);
        state.seeds[hybrid] = (state.seeds[hybrid] || 0) + 1;
        onEffect('hybrid', c, { type: hybrid, first });
        onHint(first ? `Новое растение — ${PLANTS[hybrid].name}! Семя уже в мешочке` : `+1 семя: ${PLANTS[hybrid].name}`, first ? 4000 : 2000);
      } else if (wilted) onHint('Вялый — отстоял ночь на страже, продастся за полцены');
    }
  }

  // Большая корзина в центре огорода превращает урожай в монеты: всё из корзинки для сбора — разом
  function putInBasket() {
    if (!state.carried.length) return onHint('Корзинка пуста — сначала собери урожай');
    const lockedBefore = PLANT_TYPES.filter((t) => !isUnlocked(t));

    let earned = 0;
    for (const item of state.carried) {
      earned += priceOf(item);
      state.harvested[item.type] = (state.harvested[item.type] || 0) + 1;
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
      if (isHybrid(type) || !isUnlocked(type) || state.coins < cost) return false;
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
    // Идёт дождь: случайные грядки намокают (уже мокрые — пропускаем)
    rain(dt) {
      rainCarry += WEATHER.wetCellsPerSecond * dt;
      let wetted = false;
      while (rainCarry >= 1) {
        rainCarry--;
        const cell = garden.cells[Math.floor(Math.random() * garden.cells.length)];
        if (isBasket(cell) || garden.isWet(cell)) continue;
        garden.water(cell);
        wetted = true;
      }
      if (wetted) changed();
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
        const item = { type, wilted: nights > 0 };
        if (state.carried.length < capacity()) state.carried.push(item);
        else {
          state.coins += priceOf(item);
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

    // Ночь кончилась — следующая будет по следующей строке NIGHTS
    nightPassed() {
      state.nightsSeen++;
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
        shop: PLANT_TYPES.filter((type) => !isHybrid(type)).map((type) => {
          const p = PLANTS[type];
          const unlock = p.unlock;
          return {
            type,
            name: p.name,
            unlocked: isUnlocked(type),
            seedPrice: p.seedPrice,
            defense: p.defense,
            sellPrice: p.sellPrice,
            wiltedPrice: priceOf({ type, wilted: true }),
            growSeconds: (p.stageSeconds * RIPE) / GROWTH_SPEED,
            owned: seedCount(type),
            condition: unlock && `собери ${countOf(unlock.plant, unlock.count)} (есть ${state.harvested[unlock.plant] || 0})`,
          };
        }),
      };
    },

    hasHarvest: () => Object.values(state.harvested).some((n) => n > 0),

    // Пары спелых соседей, из которых может выйти гибрид: [[клетка, клетка], ...] (для пыльцы между ними)
    crossPairs() {
      const pairs = [];
      for (const c of garden.cells) {
        if (garden.stage(c) !== RIPE) continue;
        for (const [dx, dz] of [[1, 0], [0, 1]]) { // вправо и вниз — каждая пара по разу
          const n = { x: c.x + dx, z: c.z + dz };
          if (!isInGarden(n) || garden.stage(n) !== RIPE) continue;
          const other = garden.cell(n).plant;
          const match = HYBRIDS.some((h) => {
            const [a, b] = PLANTS[h].hybrid;
            return (a === c.plant && b === other) || (b === c.plant && a === other);
          });
          if (match) pairs.push([{ x: c.x, z: c.z }, n]);
        }
      }
      return pairs;
    },

    // Для сохранения (позицию героя добавляет main.js)
    toSave() {
      const { coins, embers, seeds, harvested, carried, basketLevel, tool, selectedSeed, discovered, nightsSeen } = state;
      return { cells: garden.toSave(), coins, embers, seeds, harvested, carried, basketLevel, tool, selectedSeed, discovered, nightsSeen };
    },
    load(saved) {
      // файл могли поправить руками — все числа приводим к целым неотрицательным
      const count = (n) => Math.max(0, Math.floor(Number(n)) || 0);
      const counts = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([t]) => PLANTS[t]).map(([t, n]) => [t, count(n)]));
      garden.load(Array.isArray(saved.cells) ? saved.cells : []);
      state.coins = count(saved.coins);
      state.embers = count(saved.embers);
      // в старых сохранениях ночей не считали: кто уже прогонял духов — начинает не с самой первой ночи
      state.nightsSeen = saved.nightsSeen !== undefined ? count(saved.nightsSeen) : state.embers > 0 ? 2 : 0;
      state.seeds = counts(saved.seeds);
      // огород стал 9×9 с корзиной в центре: что росло на её месте — семенем в мешочек
      const underBasket = garden.cell(BASKET_CELL).plant;
      if (underBasket) {
        garden.harvest(BASKET_CELL);
        if (!isFree(underBasket)) state.seeds[underBasket] = (state.seeds[underBasket] || 0) + 1;
      }
      state.harvested = counts(saved.harvested);
      state.basketLevel = Math.min(count(saved.basketLevel), HAND_BASKET.length - 1);
      state.discovered = (Array.isArray(saved.discovered) ? saved.discovered : []).filter((t) => PLANTS[t] && isHybrid(t));
      if (TOOL_IDS.includes(saved.tool)) state.tool = saved.tool;
      if (PLANTS[saved.selectedSeed]) state.selectedSeed = saved.selectedSeed;
      checkSelectedSeed();
      // в старых сохранениях в корзинке просто названия растений: ['carrot', ...]
      state.carried = (Array.isArray(saved.carried) ? saved.carried : [])
        .map((item) => (typeof item === 'string' ? { type: item, wilted: false } : { type: item?.type, wilted: !!item?.wilted }))
        .filter((item) => PLANTS[item.type])
        .slice(0, capacity());
    },
  };
}
