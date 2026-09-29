// Ночь — только правила: когда и по какому ряду приходят духи, где останавливаются, что пропадает, кто их пугает,
// что сказать утром. Ряд — столбец клеток x от дальнего края огорода (z = 7) к дому (z = 0).
// Как духи выглядят и двигаются — world/spirits.js. Числа — config.js → SPIRITS.
// Набеги идут только во время игры: часы суток стоят, пока игра закрыта или открыто меню.
import { SPIRITS, PLANTS, CELL_SIZE, GARDEN_SIZE } from './config.js';
import { countOf } from './game.js';
import { cellToWorld } from './grid.js';

const rand = (a, b) => a + Math.random() * (b - a);

// «1 монету», «3 монеты», «12 монет»
export function coinsOf(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} монету`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} монеты`;
  return `${n} монет`;
}

function pickKind() {
  const kinds = Object.entries(SPIRITS.kinds);
  let r = Math.random() * kinds.reduce((sum, [, k]) => sum + k.weight, 0);
  for (const [id, k] of kinds) {
    r -= k.weight;
    if (r <= 0) return id;
  }
  return kinds[0][0];
}

// «1 семя», «2 семени», «5 семян»
function seedsOf(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} семя`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} семени`;
  return `${n} семян`;
}

// Итог ночи для утреннего окна: строки [подпись, значение]; null — ночь прошла тихо, показывать нечего
export function morningReport({ scared, lost, faded }) {
  const gone = Object.entries(lost.crops).filter(([, n]) => n > 0).map(([type, n]) => countOf(type, n));
  if (lost.coins) gone.push(coinsOf(lost.coins));
  if (!scared && !gone.length && !faded.length) return null;
  const rows = [
    ['Прогнано духов', String(scared)],
    ['Огоньков', `+${scared}`],
    ['Унесли', gone.length ? gone.join(', ') : 'ничего'],
  ];
  if (faded.length) rows.push(['Отцвели', faded.map((f) => `${PLANTS[f.type].name.toLowerCase()}${f.seeds ? ` (+${seedsOf(f.seeds)})` : ''}`).join(', ')]);
  return rows;
}

// onWarn(row) — скоро придёт дух по ряду row: в тумане проступает свечение
// onSpawn(spirit) — пришёл дух: { id, kind, name, row, target: null } (target появляется, когда он что-то хватает)
// onStolen(spirit, loot) — дух что-то унёс: loot { crop } или { coins }
// onMorning(summary) — ночь кончилась: { scared, lost, faded } (строки для окна — morningReport)
export function createNight({ game, daytime, onWarn, onSpawn, onStolen, onMorning }) {
  let active = false;
  let left = 0;        // сколько духов ещё придёт этой ночью
  let wait = 0;        // секунд до следующего предупреждения
  let warned = null;   // { row, t } — у ряда светится туман, дух вот-вот поднимется
  let spirits = [];    // духи этой ночи, которые ещё здесь
  let nextId = 1;
  let lost = { crops: {}, coins: 0 };
  let scared = 0;      // сколько духов прогнали за ночь

  function reset() {
    lost = { crops: {}, coins: 0 };
    scared = 0;
  }

  function startNight() {
    active = true;
    const [min, max] = SPIRITS.perNight;
    left = Math.round(rand(min, max));
    wait = SPIRITS.firstDelay;
    warned = null;
    reset();
  }

  function endNight() {
    active = false;
    left = 0;
    warned = null;
    spirits = [];
    const faded = game.endOfNight(); // защитники отслужили ещё ночь; кто своё отслужил — отцвёл
    onMorning({ scared, lost, faded });
  }

  function warn() {
    warned = { row: Math.floor(Math.random() * GARDEN_SIZE), t: SPIRITS.warnSeconds };
    onWarn?.(warned.row);
  }

  function spawn(row) {
    const kind = pickKind();
    const spirit = { id: nextId++, kind, name: SPIRITS.kinds[kind].name, row, target: null, fear: 0, loot: null, fled: false };
    spirits.push(spirit);
    onSpawn(spirit);
  }

  return {
    get active() { return active; },

    update(dt) {
      const phase = daytime.phase();
      if (phase.id === 'night' && !active) startNight();
      if (phase.id !== 'night' && active) endNight();
      if (warned) {
        warned.t -= dt;
        if (warned.t <= 0) {
          spawn(warned.row);
          warned = null;
        }
      }
      if (!active || !left) return;
      wait -= dt;
      if (wait <= 0 && !warned) {
        left--;
        wait = rand(...SPIRITS.interval);
        warn();
      }
    },

    // Где дух остановится в своём ряду: первое спелое растение впереди (дух идёт от дальнего края к дому,
    // z — где он сейчас, в клетках). null — впереди спелых нет, ряд пройден насквозь.
    stopAhead(spirit, z) {
      let stop = null;
      for (const c of game.ripeCells()) {
        if (c.x !== spirit.row || c.z > z + 0.05) continue;
        if (!stop || c.z > stop.z) stop = c;
      }
      return stop;
    },

    // Спелое ли ещё растение, которое дух тянет (его могли собрать)
    isRipe(cell) {
      return game.ripeCells().some((c) => c.x === cell.x && c.z === cell.z);
    },

    // Дух дотянул: забрать добычу. target — { cell } (растение) или { basket: true }.
    // Возвращает { crop } / { coins } или null (добычи уже нет)
    grab(spirit, target) {
      let loot = null;
      if (target.cell) {
        const nights = game.garden.cell(target.cell).nights || 0;
        const crop = game.stealCrop(target.cell);
        if (crop) {
          lost.crops[crop] = (lost.crops[crop] || 0) + 1;
          loot = { crop, nights };
        }
      } else if (target.basket) {
        const want = Math.min(SPIRITS.maxCoins, Math.max(1, Math.round(game.state.coins * SPIRITS.coinShare)));
        const coins = game.stealCoins(want);
        if (coins) {
          lost.coins += coins;
          loot = { coins };
        }
      }
      if (loot) {
        spirit.target = target;
        spirit.loot = loot;
        onStolen(spirit, loot);
      }
      return loot;
    },

    // Страх: спелые растения рядом нагоняют страх на духа (каждый кадр, pos — где дух сейчас).
    // → { slow — во сколько раз медленнее (0…1), from — самое страшное растение рядом, scared — пора убегать }
    scare(spirit, pos, dt) {
      if (spirit.fled) return { slow: 0, from: null, scared: false };
      let rate = 0;
      let slow = 0;
      let from = null;
      let strongest = 0;
      for (const c of game.ripeCells()) {
        const d = PLANTS[game.garden.cell(c).plant].defense;
        const at = cellToWorld(c.x, c.z);
        const dist = Math.hypot(pos.x - at.x, pos.z - at.z) / CELL_SIZE;
        if (dist > d.radius) continue;
        const r = d.power * (1 - 0.5 * (dist / d.radius));
        rate += r;
        slow = Math.max(slow, d.slow);
        if (r > strongest) { strongest = r; from = c; }
      }
      spirit.fear += rate * dt;
      return { slow, from, scared: spirit.fear >= SPIRITS.kinds[spirit.kind].courage };
    },

    // Дух испугался и убегает: добычу роняет (она возвращается), оставляет огонёк.
    // → что вернулось: { crop } / { coins } / null
    flee(spirit) {
      if (spirit.fled) return null;
      spirit.fled = true;
      scared++;
      const loot = spirit.loot;
      spirit.loot = null;
      if (loot?.crop) {
        const back = game.returnCrop(spirit.target.cell, loot.crop, loot.nights);
        if (back) lost.crops[loot.crop]--;
        return back ? { crop: loot.crop } : null;
      }
      if (loot?.coins) {
        game.returnCoins(loot.coins);
        lost.coins -= loot.coins;
        return { coins: loot.coins };
      }
      return null;
    },

    // Дух ушёл в туман
    gone(spirit) {
      spirits = spirits.filter((s) => s !== spirit);
    },

    // Подпись для подсказки: «Призрак утащил тыкву»
    describe(spirit, loot) {
      if (loot.crop) return `${spirit.name} утащил ${PLANTS[loot.crop].forms[0]}`;
      return `${spirit.name} утащил из корзинки ${coinsOf(loot.coins)}`;
    },

    // Только для проверки (панель G): позвать духа прямо сейчас (случайный ряд), даже днём
    spawnNow() {
      if (!active) reset();
      warn();
    },
  };
}
