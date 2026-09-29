// Ночь — только правила: когда приходят духи, к чему идёт каждый, что пропадает, что сказать утром.
// Как духи выглядят и двигаются — world/spirits.js. Числа — config.js → SPIRITS.
// Набеги идут только во время игры: часы суток стоят, пока игра закрыта или открыто меню.
import { SPIRITS, PLANTS } from './config.js';
import { countOf } from './game.js';

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

// onSpawn(spirit) — пришёл дух: { id, kind, name, target } (target: { cell } | { basket: true } | null — просто бродит)
// onStolen(spirit, loot) — дух что-то унёс: loot { crop } или { coins }
// onMorning(text) — ночь кончилась: что пропало (или null, если ничего)
export function createNight({ game, daytime, onSpawn, onStolen, onMorning }) {
  let active = false;
  let schedule = [];   // когда придут духи (доля ночи 0..1)
  let spirits = [];    // духи этой ночи, которые ещё здесь
  let nextId = 1;
  let cropsTaken = 0;  // сколько грядок уже унесли или вот-вот унесут
  let lost = { crops: {}, coins: 0 };

  function startNight() {
    active = true;
    const [min, max] = SPIRITS.perNight;
    const count = Math.round(rand(min, max));
    schedule = Array.from({ length: count }, () => rand(0.05, 0.8)).sort((a, b) => a - b);
    cropsTaken = 0;
    lost = { crops: {}, coins: 0 };
  }

  function endNight() {
    active = false;
    schedule = [];
    spirits = [];
    const parts = Object.entries(lost.crops).map(([type, n]) => countOf(type, n));
    if (lost.coins) parts.push(coinsOf(lost.coins));
    onMorning(parts.length ? `Духи унесли за ночь: ${parts.join(', ')}` : null);
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
    const spirit = { id: nextId++, kind, name: SPIRITS.kinds[kind].name, target: chooseTarget() };
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
        const crop = game.stealCrop(t.cell);
        if (crop) {
          lost.crops[crop] = (lost.crops[crop] || 0) + 1;
          loot = { crop };
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
      if (loot) onStolen(spirit, loot);
      return loot;
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
      }
      spawn();
    },
  };
}
