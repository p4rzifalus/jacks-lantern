// Часы суток: утро → день → вечер → ночь по кругу (длины — config.js → DAY_CYCLE).
// Только правила времени; как это выглядит — render/day-night.js.
// Идут только во время игры; время суток хранится в сохранении (новая игра — с утра).
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

    // Как сейчас выглядят сутки: каждая часть держит свой вид почти всё время, а в соседнюю перетекает
    // только у границы — за DAY_CYCLE.transitionSeconds (половина до границы, половина после).
    // Так табло и картинка не расходятся: «вечер» — значит, вечерний свет. → { from, to, t } (t — 0..1, сглажено)
    blend() {
      const i = Math.max(0, phases.findIndex((ph) => time >= ph.start && time < ph.start + ph.seconds));
      const p = phases[i];
      const prev = phases[(i + phases.length - 1) % phases.length];
      const next = phases[(i + 1) % phases.length];
      const edge = Math.min(DAY_CYCLE.transitionSeconds / 2, p.seconds / 2);
      const into = time - p.start;
      const left = p.start + p.seconds - time;
      const s = (x) => x * x * (3 - 2 * x);
      if (into < edge) return { from: prev.id, to: p.id, t: s(0.5 + into / (2 * edge)) };
      if (left < edge) return { from: p.id, to: next.id, t: s(0.5 - left / (2 * edge)) };
      return { from: p.id, to: p.id, t: 0 };
    },
  };
}
