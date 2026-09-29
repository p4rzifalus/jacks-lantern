// Ночь — только правила: когда и по какому ряду приходят духи, где останавливаются, что пропадает,
// какие растения по кому бьют и когда дух пугается, что сказать утром.
// Ряд — столбец клеток x от дальнего края огорода (z = 7) к дому (z = 0); «вперёд» от растения — к туману (z больше).
// Как духи выглядят и двигаются — world/spirits.js. Числа — config.js → SPIRITS.
// Набеги идут только во время игры: часы суток стоят, пока игра закрыта или открыто меню.
import { SPIRITS, PLANTS, GARDEN_SIZE } from './config.js';
import { countOf } from './game.js';
import { plural } from './text.js';

const rand = (a, b) => a + Math.random() * (b - a);

// «1 монету», «3 монеты», «12 монет»
export const coinsOf = (n) => plural(n, ['монету', 'монеты', 'монет']);

function pickKind() {
  const kinds = Object.entries(SPIRITS.kinds);
  let r = Math.random() * kinds.reduce((sum, [, k]) => sum + k.weight, 0);
  for (const [id, k] of kinds) {
    r -= k.weight;
    if (r <= 0) return id;
  }
  return kinds[0][0];
}

// Достаёт ли атака растения с клетки c до духа в точке at (в клетках, дробные числа)
function reaches(attack, c, at) {
  const dx = Math.abs(at.x - c.x);
  const dz = at.z - c.z; // > 0 — дух впереди (со стороны тумана)
  switch (attack.type) {
    case 'whip': case 'spark': return dx <= 0.5 && dz >= -0.5 && dz <= attack.reach + 0.5;
    case 'wall': return dx <= 0.5 && Math.abs(dz) <= 0.5;
    case 'beam': return dx <= 1.5 && dz >= -0.5 && dz <= attack.reach + 0.5;
    case 'spores': return dx <= attack.reach + 0.5 && Math.abs(dz) <= attack.reach + 0.5;
    default: return false;
  }
}

// Дух на огороде и ещё не испугался — растения могут его достать (в тумане и на дальней дорожке — нет)
const onField = (s) => s.at && s.at.z <= GARDEN_SIZE - 0.5 && !s.fled && s.courage > 0;

// «1 семя», «2 семени», «5 семян»
const seedsOf = (n) => plural(n, ['семя', 'семени', 'семян']);

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
// onSpawn(spirit) — пришёл дух: { id, kind, name, row, courage, target: null } (target появляется, когда он что-то хватает).
//   Где дух сейчас, сообщает картинка (world/spirits.js): spirit.at = { x, z } в клетках, или null — его не достать.
// onAttack({ type, reach, from, targets, delay }) — растение с клетки from ударило; delay — через сколько секунд удар долетит
// onHit(spirit, from) — удар попал, смелость убавилась (на нуле spirit.courage <= 0 — дух испугался, убегает картинка)
// onStolen(spirit, loot) — дух что-то унёс: loot { crop } или { coins }
// onMorning(summary) — ночь кончилась: { scared, lost, faded } (строки для окна — morningReport)
export function createNight({ game, daytime, onWarn, onSpawn, onAttack, onHit, onStolen, onMorning }) {
  let active = false;
  let left = 0;        // сколько духов ещё придёт этой ночью
  let wait = 0;        // секунд до следующего предупреждения
  let warned = null;   // { row, t } — у ряда светится туман, дух вот-вот поднимется
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
  }

  // Удар попал: убавить смелость
  function hit(spirit, power, from) {
    if (spirit.fled || spirit.courage <= 0) return;
    spirit.courage -= power;
    spirit.hitBy = from;
    onHit?.(spirit, from);
  }

  // Каждое спелое растение, когда готово, бьёт духов, до которых достаёт
  function attack(dt) {
    for (const [key, t] of ready) ready.set(key, t - dt);
    for (const f of [...flying]) {
      f.t -= dt;
      if (f.t > 0) continue;
      flying.splice(flying.indexOf(f), 1);
      hit(f.spirit, f.power, f.from);
    }
    const targets = spirits.filter(onField);
    if (!targets.length) return;
    for (const c of game.ripeCells()) {
      const key = `${c.x},${c.z}`;
      if ((ready.get(key) || 0) > 0) continue;
      const a = PLANTS[game.garden.cell(c).plant].attack;
      let victims = targets.filter((s) => reaches(a, c, s.at));
      if (!victims.length) continue;
      ready.set(key, a.every);
      if (a.type === 'spark') {
        // искра летит вперёд по ряду в ближайшего духа
        const first = victims.reduce((best, s) => (s.at.z < best.at.z ? s : best));
        victims = [first];
        const delay = Math.max(0.05, Math.hypot(first.at.x - c.x, first.at.z - c.z) / a.speed);
        flying.push({ spirit: first, power: a.power, from: c, t: delay });
        onAttack?.({ type: a.type, reach: a.reach, from: c, targets: victims, delay });
        continue;
      }
      onAttack?.({ type: a.type, reach: a.reach, from: c, targets: victims, delay: 0 });
      for (const s of victims) hit(s, a.power, c);
    }
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
    const spirit = { id: nextId++, kind, name: SPIRITS.kinds[kind].name, row, courage: SPIRITS.kinds[kind].courage, at: null, hitBy: null, target: null, loot: null, fled: false };
    spirits.push(spirit);
    onSpawn(spirit);
  }

  return {
    get active() { return active; },
    // Ходит ли по огороду дух, которого можно достать (растения настораживаются)
    get threat() { return spirits.some(onField); },

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
      if (spirits.length) attack(dt);
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

    // Сколько секунд дух тянет добычу: тыкву — дольше (PLANTS → defense → hold), остальное — обычное время
    holdSeconds(target) {
      const plant = target.cell && game.garden.cell(target.cell).plant;
      return (plant && PLANTS[plant].defense.hold) || SPIRITS.grabSeconds;
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
      if (warned) spawn(warned.row); // предыдущий вызванный ещё не поднялся — пусть поднимается сразу
      warn();
    },
  };
}
