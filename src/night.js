// Ночь — только правила: сколько духов приходит и откуда, к чему идут, что пропадает,
// какие растения (и фонарь енота) по кому бьют и когда дух пугается, что сказать утром.
// Координаты — в клетках огорода (дробные числа); корзина — в центральной клетке (BASKET_CELL).
// Как духи выглядят и двигаются — world/spirits.js. Числа — config.js → SPIRITS, NIGHTS, LANTERN.
// Набеги идут только во время игры: часы суток стоят, пока игра закрыта или открыто меню.
import { SPIRITS, PLANTS, GARDEN_SIZE, NIGHTS, NIGHT_GROWTH, NIGHT_SCALING, LANTERN, DAY_CYCLE } from './config.js';
import { countOf } from './game.js';
import { plural } from './text.js';

const rand = (a, b) => a + Math.random() * (b - a);

// Стороны острова, откуда поднимаются духи, — в порядке, в котором они «открываются» от ночи к ночи:
// сначала с ближнего к зрителю края (там, где появляется енот), потом сбоку, в конце — из-за дома
export const SIDES = ['south', 'east', 'west', 'north'];

// «1 монету», «3 монеты», «12 монет»
export const coinsOf = (n) => plural(n, ['монету', 'монеты', 'монет']);

// Какая по счёту ночь (0 — первая) → { spirits, kinds, sides }. После списка — как последняя, но духов больше
export function nightPlan(index) {
  const last = NIGHTS.length - 1;
  const plan = NIGHTS[Math.min(index, last)];
  if (index <= last) return plan;
  const spirits = Math.min(NIGHT_GROWTH.maxSpirits, plan.spirits + (index - last) * NIGHT_GROWTH.moreEachNight);
  return { ...plan, spirits };
}

function pickKind(weights) {
  const kinds = Object.entries(weights);
  let r = Math.random() * kinds.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of kinds) {
    r -= w;
    if (r <= 0) return id;
  }
  return kinds[0][0];
}

// Достаёт ли атака растения с клетки c до духа в точке at — по расстоянию, со всех сторон
function reaches(attack, c, at) {
  const dx = Math.abs(at.x - c.x);
  const dz = Math.abs(at.z - c.z);
  const d = Math.hypot(dx, dz);
  switch (attack.type) {
    case 'whip': return d <= attack.reach + 0.75;           // соседние клетки (и по диагонали)
    case 'spark': case 'beam': return d <= attack.reach + 0.5;
    case 'wall': return d <= 0.75;                           // только тот, кто тянет её саму
    case 'spores': return Math.max(dx, dz) <= attack.reach + 0.5;
    default: return false;
  }
}

// Дух над огородом или дорожкой и ещё не испугался — растения и фонарь могут его достать (в тумане — нет)
const onField = (s) => s.at && !s.fled && s.courage > 0
  && s.at.x >= -1.5 && s.at.x <= GARDEN_SIZE + 0.5 && s.at.z >= -1.5 && s.at.z <= GARDEN_SIZE + 0.5;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// «морковь ×2, редис — собери за полцены»
function drySummary(types) {
  const counts = {};
  for (const t of types) counts[t] = (counts[t] || 0) + 1;
  const list = Object.entries(counts).map(([t, n]) => `${PLANTS[t].name.toLowerCase()}${n > 1 ? ` ×${n}` : ''}`);
  return `${list.join(', ')} — собери за полцены`;
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
  if (faded.length) rows.push(['Засохли', drySummary(faded)]);
  return rows;
}

// onWarn(from) — скоро поднимется дух: from = { side, t } — сторона острова и место вдоль неё (0..1)
// onSpawn(spirit) — пришёл дух: { id, kind, name, from, courage, target: null } (target — что он схватил).
//   Где дух сейчас, сообщает картинка (world/spirits.js): spirit.at = { x, z } в клетках, или null — его не достать.
// onAttack({ type, reach, from, targets, delay }) — растение с клетки from ударило; delay — через сколько секунд удар долетит
// onHit(spirit, from) — удар попал, смелость убавилась (на нуле spirit.courage <= 0 — дух испугался, убегает картинка)
// onStolen(spirit, loot) — дух что-то унёс: loot { crop } или { coins }
// onMorning(summary) — ночь кончилась: { scared, lost, faded } (строки для окна — morningReport)
export function createNight({ game, daytime, onWarn, onSpawn, onAttack, onHit, onStolen, onMorning }) {
  let active = false;
  let bravery = 1;    // во сколько раз духи этой ночи смелее обычного (NIGHT_SCALING)
  let plan = null;     // какая ночь: сколько духов, каких, с каких сторон, сколькими волнами
  let queue = [];      // кто ещё придёт: [{ at — секунд от начала ночи, kind, from }]
  let clock = 0;       // секунд с начала ночи
  let warned = [];     // свечение в тумане уже горит: [{ t — секунд до подъёма, kind, from }]
  let spirits = [];    // духи этой ночи, которые ещё здесь
  let nextId = 1;
  let lost = { crops: {}, coins: 0 };
  let scared = 0;      // сколько духов прогнали за ночь
  const ready = new Map(); // клетка «x,z» → сколько секунд растению до следующего удара
  let flying = [];     // удары в пути (искры): { spirit, power, from, t }

  function reset() {
    lost = { crops: {}, coins: 0 };
    scared = 0;
    ready.clear();
    flying = [];
    warned = [];
  }

  // Удар попал: убавить смелость
  function hit(spirit, power, from) {
    if (spirit.fled || spirit.courage <= 0) return;
    spirit.courage -= power * game.perks().attackPower; // улучшение «Сильные корни»
    spirit.hitBy = from;
    onHit?.(spirit, from);
  }

  // Фонарь енота: духи в его свете понемногу теряют смелость (призраки — быстро, скелеты — еле-еле).
  // Шаг они не сбивают (lit — для картинки: бледнеют, но идут дальше), так что за духом приходится идти
  function lantern(dt, heroAt, targets) {
    for (const s of targets) s.lit = false;
    if (!heroAt) return;
    const radius = LANTERN.radius * game.perks().lanternRadius; // улучшение «Яркий фонарь»
    for (const s of targets) {
      if (dist(s.at, heroAt) > radius) continue;
      s.lit = true;
      s.courage -= LANTERN.power * (LANTERN.fear[s.kind] ?? 1) * dt;
      s.hitBy = null; // напугал фонарь, а не растение
    }
  }

  // Каждое спелое растение, когда готово, бьёт духов, до которых достаёт
  function attack(dt, heroAt) {
    for (const [key, t] of ready) ready.set(key, t - dt);
    for (const f of [...flying]) {
      f.t -= dt;
      if (f.t > 0) continue;
      flying.splice(flying.indexOf(f), 1);
      hit(f.spirit, f.power, f.from);
    }
    const targets = spirits.filter(onField);
    if (!targets.length) return;
    lantern(dt, heroAt, targets);
    for (const c of game.ripeCells()) {
      const key = `${c.x},${c.z}`;
      if ((ready.get(key) || 0) > 0) continue;
      const a = PLANTS[game.garden.cell(c).plant].attack;
      let victims = targets.filter((s) => s.courage > 0 && reaches(a, c, s.at));
      if (!victims.length) continue;
      ready.set(key, a.every);
      if (a.type === 'spark') {
        // искра летит в ближайшего духа
        const first = victims.reduce((best, s) => (dist(s.at, c) < dist(best.at, c) ? s : best));
        victims = [first];
        const delay = Math.max(0.05, dist(first.at, c) / a.speed);
        flying.push({ spirit: first, power: a.power, from: c, t: delay });
        onAttack?.({ type: a.type, reach: a.reach, from: c, targets: victims, delay });
        continue;
      }
      if (a.type === 'beam') {
        // луч светит в сторону ближайшего духа узким конусом: достаёт тех, кто примерно в том же направлении
        const first = victims.reduce((best, s) => (dist(s.at, c) < dist(best.at, c) ? s : best));
        const dir = Math.atan2(first.at.z - c.z, first.at.x - c.x);
        victims = victims.filter((s) => {
          const da = Math.atan2(s.at.z - c.z, s.at.x - c.x) - dir;
          return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) < 0.45 || dist(s.at, c) < 1;
        });
        onAttack?.({ type: a.type, reach: a.reach, from: c, targets: victims, delay: 0, toward: first.at });
        for (const s of victims) hit(s, a.power, c);
        continue;
      }
      onAttack?.({ type: a.type, reach: a.reach, from: c, targets: victims, delay: 0 });
      for (const s of victims) hit(s, a.power, c);
    }
  }

  // Расписание ночи: духи приходят по одному, через примерно равные промежутки (чуть случайно, чтобы не по часам)
  function startNight() {
    active = true;
    reset();
    clock = 0;
    plan = nightPlan(game.state.nightsSeen);
    // сильный огород зовёт больше духов и смелее (config.js → NIGHT_SCALING)
    const guards = game.ripeCells().length;
    const extra = Math.min(NIGHT_SCALING.maxExtra, Math.floor(guards / NIGHT_SCALING.plantsPerSpirit));
    bravery = Math.min(NIGHT_SCALING.maxCourage, 1 + guards * NIGHT_SCALING.couragePerPlant);
    plan = { ...plan, spirits: plan.spirits + extra };
    const sides = SIDES.slice(0, plan.sides);
    const nightSeconds = (DAY_CYCLE.phases.find((p) => p.id === 'night').minutes * 60) / DAY_CYCLE.speed;
    const gap = (nightSeconds * SPIRITS.spread - SPIRITS.firstDelay) / plan.spirits;
    queue = [];
    for (let i = 0; i < plan.spirits; i++) {
      queue.push({
        at: SPIRITS.firstDelay + gap * (i + rand(-0.3, 0.3)),
        kind: pickKind(plan.kinds),
        from: { side: sides[Math.floor(Math.random() * sides.length)], t: rand(0.1, 0.9) },
      });
    }
    queue.sort((a, b) => a.at - b.at);
  }

  function endNight() {
    active = false;
    queue = [];
    warned = [];
    spirits = [];
    game.nightPassed(); // следующая ночь — по следующей строке NIGHTS
    const faded = game.endOfNight(); // защитники отслужили ещё ночь; кто своё отслужил — засох
    onMorning({ scared, lost, faded });
  }

  function warn(kind, from) {
    warned.push({ t: SPIRITS.warnSeconds, kind, from });
    onWarn?.(from);
  }

  function spawn(kind, from) {
    const k = SPIRITS.kinds[kind];
    const courage = k.courage * bravery;
    const spirit = { id: nextId++, kind, name: k.name, from, courage, maxCourage: courage, at: null, hitBy: null, target: null, loot: null, fled: false };
    spirits.push(spirit);
    onSpawn(spirit);
  }

  return {
    get active() { return active; },
    // Ходит ли по огороду дух, которого можно достать (растения настораживаются)
    get threat() { return spirits.some(onField); },
    // Сколько это ночей уже было и какая сейчас (для проверки)
    get plan() { return plan; },

    // heroAt — где енот (в клетках): его фонарь горит ночью
    update(dt, heroAt = null) {
      const phase = daytime.phase();
      if (phase.id === 'night' && !active) startNight();
      if (phase.id !== 'night' && active) endNight();
      for (const w of [...warned]) {
        w.t -= dt;
        if (w.t > 0) continue;
        warned.splice(warned.indexOf(w), 1);
        spawn(w.kind, w.from);
      }
      if (spirits.length) attack(dt, active ? heroAt : null);
      if (!active) return;
      clock += dt;
      while (queue.length && queue[0].at - SPIRITS.warnSeconds <= clock) {
        const next = queue.shift();
        warn(next.kind, next.from);
      }
    },

    // Куда идти духу из точки at: к ближайшему спелому растению, а если спелых нет — к корзине.
    // → { cell } или { basket: true }
    targetFor(at) {
      let best = null;
      let bestD = Infinity;
      for (const c of game.ripeCells()) {
        const d = dist(c, at);
        if (d < bestD) { best = c; bestD = d; }
      }
      return best ? { cell: best } : { basket: true };
    },

    // Сколько секунд дух тянет добычу: тыкву — дольше (PLANTS → defense → hold), остальное — обычное время
    holdSeconds(target) {
      const plant = target.cell && game.garden.cell(target.cell).plant;
      return (plant && PLANTS[plant].defense.hold) || SPIRITS.grabSeconds;
    },

    // Спелое ли ещё растение, к которому идёт дух (его могли собрать или утащить)
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
        const room = Math.max(0, SPIRITS.maxCoinsPerNight - lost.coins); // за ночь — не больше стольких
        const want = Math.min(room, SPIRITS.maxCoins, Math.max(1, Math.round(game.state.coins * SPIRITS.coinShare)));
        const coins = want > 0 ? game.stealCoins(want) : 0;
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

    // Дух испугался (смелость кончилась) и убегает: добычу роняет (она возвращается), оставляет огонёк.
    // → что вернулось: { crop } / { coins } / null
    flee(spirit) {
      if (spirit.fled) return null;
      spirit.fled = true;
      spirit.at = null;
      scared++;
      const loot = spirit.loot;
      spirit.loot = null;
      if (loot?.crop) {
        game.returnCrop(spirit.target.cell, loot.crop, loot.nights);
        lost.crops[loot.crop]--;
        return { crop: loot.crop };
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
      return `${spirit.name} утащил из корзины ${coinsOf(loot.coins)}`;
    },

    // Только для проверки (панель G): позвать духа прямо сейчас с любой стороны, даже днём
    spawnNow(kind = pickKind({ ghost: 3, skeleton: 2, wisp: 2 })) {
      if (!active) reset();
      warn(kind, { side: SIDES[Math.floor(Math.random() * SIDES.length)], t: rand(0.1, 0.9) });
    },
  };
}
