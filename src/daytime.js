// Часы суток: утро → день → вечер → ночь по кругу (длины — config.js → DAY_CYCLE).
// Только правила времени; как это выглядит — render/day-night.js.
// Идут только во время игры; при каждом входе в игру — начало утра.
import { DAY_CYCLE } from './config.js';

export function createDaytime() {
  const phases = DAY_CYCLE.phases.map((p) => ({ ...p, seconds: p.minutes * 60 }));
  let start = 0;
  for (const p of phases) {
    p.start = start;
    start += p.seconds;
  }
  const total = start;
  const find = (id) => phases.find((p) => p.id === id);
  let time = 0; // секунд от начала утра

  return {
    phases,
    total,
    speed: 1, // ускорение для проверки (панель G); общая скорость — DAY_CYCLE.speed

    get time() { return time; },
    set time(value) { time = ((value % total) + total) % total; },
    // доля суток 0..1 от начала утра
    get fraction() { return time / total; },
    set fraction(value) { this.time = value * total; },

    update(dt) {
      this.time = time + dt * DAY_CYCLE.speed * this.speed;
    },

    // Какая сейчас часть суток и сколько её прошло (0..1)
    phase() {
      const p = phases.find((ph) => time >= ph.start && time < ph.start + ph.seconds) || phases[0];
      return { id: p.id, name: p.name, progress: (time - p.start) / p.seconds };
    },

    // Значение, которое держится ровно всю часть суток и меняется только у её границ (за edge секунд):
    // value(id) — значение для части суток. Для того, что не должно «ползти» весь день (лучи).
    steady(value, edge = 10) {
      const i = phases.findIndex((ph) => time >= ph.start && time < ph.start + ph.seconds);
      const p = phases[Math.max(0, i)];
      const prev = phases[(Math.max(0, i) + phases.length - 1) % phases.length];
      const next = phases[(Math.max(0, i) + 1) % phases.length];
      const into = time - p.start;
      const left = p.start + p.seconds - time;
      const s = (x) => x * x * (3 - 2 * x);
      if (into < edge) return value(prev.id) + (value(p.id) - value(prev.id)) * s(0.5 + into / (2 * edge));
      if (left < edge) return value(p.id) + (value(next.id) - value(p.id)) * s(0.5 - left / (2 * edge));
      return value(p.id);
    },

    // Солнце идёт по небу от начала утра до конца вечера, луна — всю ночь.
    // u — сколько пути прошло (0 — восход, 1 — заход), или null, если светило за горизонтом
    sunPath() {
      const rise = find('morning').start;
      const set = find('evening').start + find('evening').seconds;
      return time >= rise && time < set ? (time - rise) / (set - rise) : null;
    },
    moonPath() {
      const night = find('night');
      return time >= night.start ? (time - night.start) / night.seconds : null;
    },

    // Между какими частями суток сейчас переход: вид каждой части — в её середине,
    // между серединами плавно перетекает. → { from, to, t } (t — 0..1, уже сглажено)
    blend() {
      const mids = phases.map((p) => p.start + p.seconds / 2);
      for (let i = 0; i < phases.length; i++) {
        const a = mids[i];
        const b = i + 1 < phases.length ? mids[i + 1] : mids[0] + total;
        const t = time < mids[0] ? time + total : time; // до середины утра — ещё переход из ночи
        if (t >= a && t < b) {
          const x = (t - a) / (b - a);
          return { from: phases[i].id, to: phases[(i + 1) % phases.length].id, t: x * x * (3 - 2 * x) };
        }
      }
      return { from: phases[0].id, to: phases[0].id, t: 0 };
    },
  };
}
