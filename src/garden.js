// Грядки — только правила: что посажено в каждой клетке, мокрая ли земля, какая стадия.
// Посадка и полив не зависят друг от друга: растение растёт, когда на грядке есть и семечко, и вода (в любом порядке).
// Как это выглядит, решает world/garden-view.js.
import { GARDEN_SIZE, PLANTS, GROWTH_SPEED, SOIL } from './config.js';

export const EMPTY = -1;
export const RIPE = 3;

const dryMs = () => SOIL.dryMinutes * 60 * 1000;

export class GardenState {
  constructor() {
    this.growth = 1;      // во сколько раз быстрее растёт всё (улучшение «Тёплая земля»)
    this.extraNights = 0; // на сколько ночей дольше стоят на страже (улучшение «Стойкие растения»)
    this.cells = [];
    for (let x = 0; x < GARDEN_SIZE; x++) {
      for (let z = 0; z < GARDEN_SIZE; z++) this.cells.push({ x, z, plant: null, plantedAt: null, wateredAt: null, nights: 0 });
    }
  }

  cell(c) {
    return this.cells[c.x * GARDEN_SIZE + c.z];
  }

  // С какого момента растение растёт: когда на грядке сошлись семечко и вода. null — не растёт
  // (не полито, или земля высохла ещё до посадки)
  growsFrom(cell) {
    const { plant, plantedAt, wateredAt } = cell;
    if (!plant || !wateredAt) return null;
    if (wateredAt >= plantedAt) return wateredAt;               // сначала посадили, потом полили
    return plantedAt - wateredAt < dryMs() ? plantedAt : null; // посадили в мокрую землю
  }

  // Мокрая ли земля: под растущим растением — пока не соберут, пустая — пока не высохнет
  isWet(c, now = Date.now()) {
    const cell = this.cell(c);
    if (!cell.wateredAt) return false;
    if (this.growsFrom(cell) !== null) return true;
    return now - cell.wateredAt < dryMs();
  }

  // Стадия растёт сама из «сколько прошло с тех пор, как есть и семечко, и вода» — никаких таймеров
  stage(c, now = Date.now()) {
    const cell = this.cell(c);
    if (!cell.plant) return EMPTY;
    const from = this.growsFrom(cell);
    if (from === null) return 0;
    const stageMs = (PLANTS[cell.plant].stageSeconds * 1000) / (GROWTH_SPEED * this.growth);
    return Math.max(0, Math.min(RIPE, Math.floor((now - from) / stageMs))); // часы устройства могли отставать — не меньше 0
  }

  // Сухое: спелое растение, которое отслужило на страже все свои ночи (PLANTS → defense → nights).
  // Стоит на грядке, ночью не защищает и духам не нужно; собирается за полцены и даёт семена
  isDry(c, now = Date.now()) {
    const cell = this.cell(c);
    return this.stage(c, now) === RIPE && cell.nights >= PLANTS[cell.plant].defense.nights + this.extraNights;
  }

  // Спелое и живое — стоит ночью на страже
  isGuard(c, now = Date.now()) {
    return this.stage(c, now) === RIPE && !this.isDry(c, now);
  }

  plant(c, type) {
    Object.assign(this.cell(c), { plant: type, plantedAt: Date.now(), nights: 0 }); // вода в земле остаётся
  }

  water(c) {
    this.cell(c).wateredAt = Date.now();
  }

  // Собрать: клетка снова пустая и сухая (растение выпило воду), возвращаем, что собрали
  harvest(c) {
    const cell = this.cell(c);
    const type = cell.plant;
    Object.assign(cell, { plant: null, plantedAt: null, wateredAt: null, nights: 0 });
    return type;
  }

  // Вернуть спелый урожай на пустую грядку (дух испугался и уронил его). nights — сколько ночей уже отслужило
  putBackRipe(c, type, nights = 0) {
    const cell = this.cell(c);
    if (cell.plant) return false;
    const ripeMs = (PLANTS[type].stageSeconds * 1000 * RIPE) / (GROWTH_SPEED * this.growth);
    const at = Date.now() - ripeMs - 1000;
    Object.assign(cell, { plant: type, plantedAt: at, wateredAt: at, nights });
    return true;
  }

  // Для сохранения: только клетки, где что-то есть
  toSave() {
    return this.cells
      .filter((cell) => cell.plant || this.isWet(cell))
      .map(({ x, z, plant, plantedAt, wateredAt, nights }) => ({ x, z, plant, plantedAt, wateredAt, nights }));
  }

  load(saved) {
    const now = Date.now();
    // сохранение с устройства, где часы спешат: время из «будущего» — считаем, что это было сейчас
    const time = (t) => (Number.isFinite(t) && t > 0 ? Math.min(t, now) : null);
    for (const { x, z, plant, plantedAt, wateredAt, nights } of saved) {
      if (!(x >= 0 && x < GARDEN_SIZE && z >= 0 && z < GARDEN_SIZE)) continue;
      const type = PLANTS[plant] ? plant : null;
      const watered = time(wateredAt);
      Object.assign(this.cell({ x, z }), {
        plant: type,
        // в старых сохранениях времени посадки нет: полито — растёт с полива, не полито — будто посадили сейчас
        plantedAt: type ? time(plantedAt) ?? watered ?? now : null,
        wateredAt: watered,
        nights: type ? Math.max(0, Number(nights) || 0) : 0,
      });
    }
  }
}
