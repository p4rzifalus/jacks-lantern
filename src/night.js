// Ночь — только правила: когда приходят духи, к чему идёт каждый, что пропадает, кто их пугает, что сказать утром.
// Как духи выглядят и двигаются — world/spirits.js. Числа — config.js → SPIRITS.
// Набеги идут только во время игры: часы суток стоят, пока игра закрыта или открыто меню.
import { SPIRITS, PLANTS, CELL_SIZE } from './config.js';
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

const same = (a, b) => a && b && a.x === b.x && a.z === b.z;

// «1 семя», «2 семени», «5 семян»
function seedsOf(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} семя`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} семени`;
  return `${n} семян`;
}

// Итог ночи одной строкой: кого прогнали, что пропало, что отцвело
export function describeMorning({ scared, lost, faded }) {
  const parts = [];
  if (scared) parts.push(`прогнано духов: ${scared}, огоньков +${scared}`);
  const gone = Object.entries(lost.crops).filter(([, n]) => n > 0).map(([type, n]) => countOf(type, n));
  if (lost.coins) gone.push(coinsOf(lost.coins));
  if (gone.length) parts.push(`унесли: ${gone.join(', ')}`);
  for (const f of faded) parts.push(`${PLANTS[f.type].name.toLowerCase()} отцвёл${f.seeds ? ` (+${seedsOf(f.seeds)})` : ''}`);
  return parts.length ? `Ночь прошла: ${parts.join('; ')}` : null;
}

// onSpawn(spirit) — пришёл дух: { id, kind, name, target } (target: { cell } | { basket: true } | null — просто бродит)
// onStolen(spirit, loot) — дух что-то унёс: loot { crop } или { coins }
// onMorning(summary) — ночь кончилась: { scared, lost, faded } (текст — describeMorning)
export function createNight({ game, daytime, onSpawn, onStolen, onMorning }) {
  let active = false;
  let schedule = [];   // когда придут духи (доля ночи 0..1)
  let spirits = [];    // духи этой ночи, которые ещё здесь
  let nextId = 1;
  let cropsTaken = 0;  // сколько грядок уже унесли или вот-вот унесут
  let lost = { crops: {}, coins: 0 };
  let scared = 0;      // сколько духов прогнали за ночь

  function startNight() {
    active = true;
    const [min, max] = SPIRITS.perNight;
    const count = Math.round(rand(min, max));
    schedule = Array.from({ length: count }, () => rand(0.05, 0.8)).sort((a, b) => a - b);
    cropsTaken = 0;
    lost = { crops: {}, coins: 0 };
    scared = 0;
  }

  function endNight() {
    active = false;
    schedule = [];
    spirits = [];
    const faded = game.endOfNight(); // защитники отслужили ещё ночь; кто своё отслужил — отцвёл
    onMorning({ scared, lost, faded });
  }

  // Куда пойти новому духу: спелая грядка (которую ещё никто не выбрал), корзинка с монетами или просто побродить
  function chooseTarget() {
    const taken = spirits.map((s) => s.target?.cell).filter(Boolean);
    const ripe = game.ripeCells().filter((c) => !taken.some((t) => same(t, c)));
    const canCrop = cropsTaken < SPIRITS.maxCropsPerNight && ripe.length > 0;
    const canCoins = game.state.coins > 0 && !spirits.some((s) => s.target?.basket);
    if (canCoins && (!canCrop || Math.random() < SPIRITS.basketChance)) return { basket: true };
    if (canCrop) {
      cropsTaken++;
      return { cell: ripe[Math.floor(Math.random() * ripe.length)] };
    }
    return null;
  }

  function spawn() {
    const kind = pickKind();
    const spirit = { id: nextId++, kind, name: SPIRITS.kinds[kind].name, target: chooseTarget(), fear: 0, loot: null, fled: false };
    spirits.push(spirit);
    onSpawn(spirit);
  }

  return {
    get active() { return active; },

    update() {
      const phase = daytime.phase();
      if (phase.id === 'night' && !active) startNight();
      if (phase.id !== 'night' && active) endNight();
      while (active && schedule.length && schedule[0] <= phase.progress) {
        schedule.shift();
        spawn();
      }
    },

    // Дух докопался: забрать добычу. Возвращает { crop } / { coins } или null (добычи уже нет)
    grab(spirit) {
      const t = spirit.target;
      let loot = null;
      if (t?.cell) {
        const nights = game.garden.cell(t.cell).nights || 0;
        const crop = game.stealCrop(t.cell);
        if (crop) {
          lost.crops[crop] = (lost.crops[crop] || 0) + 1;
          loot = { crop, nights };
        } else {
          cropsTaken--; // урожай успели собрать — эта грядка не в счёт
        }
      } else if (t?.basket) {
        const want = Math.min(SPIRITS.maxCoins, Math.max(1, Math.round(game.state.coins * SPIRITS.coinShare)));
        const coins = game.stealCoins(want);
        if (coins) {
          lost.coins += coins;
          loot = { coins };
        }
      }
      spirit.loot = loot;
      if (loot) onStolen(spirit, loot);
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
      if (!loot && spirit.target?.cell) cropsTaken--; // не успел — грядка снова «свободна» для других
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

    // Только для проверки (панель G): позвать духа прямо сейчас, даже днём
    spawnNow() {
      if (!active) {
        lost = { crops: {}, coins: 0 };
        cropsTaken = 0;
        scared = 0;
      }
      spawn();
    },
  };
}
