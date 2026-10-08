// Грядки — только правила: что посажено в каждой клетке, когда полито, какая стадия.
// Как это выглядит, решает world/garden-view.js.
import { GARDEN_SIZE, PLANTS, GROWTH_SPEED } from './config.js';

export const EMPTY = -1;
export const RIPE = 3;

export class GardenState {
  constructor() {
    this.cells = [];
    for (let x = 0; x < GARDEN_SIZE; x++) {
      for (let z = 0; z < GARDEN_SIZE; z++) this.cells.push({ x, z, plant: null, wateredAt: null, nights: 0 });
    }
  }

  cell(c) {
    return this.cells[c.x * GARDEN_SIZE + c.z];
  }

  // Стадия растёт сама из «сколько прошло с полива» — никаких таймеров
  stage(c, now = Date.now()) {
    const cell = this.cell(c);
    if (!cell.plant) return EMPTY;
    if (!cell.wateredAt) return 0;
    const stageMs = (PLANTS[cell.plant].stageSeconds * 1000) / GROWTH_SPEED;
    return Math.max(0, Math.min(RIPE, Math.floor((now - cell.wateredAt) / stageMs))); // часы устройства могли отставать — не меньше 0
  }

  isWatered(c) {
    return !!this.cell(c).wateredAt;
  }

  plant(c, type) {
    Object.assign(this.cell(c), { plant: type, wateredAt: null, nights: 0 });
  }

  water(c) {
    this.cell(c).wateredAt = Date.now();
  }

  // Собрать: клетка снова пустая, возвращаем, что собрали
  harvest(c) {
    const cell = this.cell(c);
    const type = cell.plant;
    Object.assign(cell, { plant: null, wateredAt: null, nights: 0 });
    return type;
  }

  // Вернуть спелый урожай на пустую грядку (дух испугался и уронил его). nights — сколько ночей уже отслужило
  putBackRipe(c, type, nights = 0) {
    const cell = this.cell(c);
    if (cell.plant) return false;
    const ripeMs = (PLANTS[type].stageSeconds * 1000 * RIPE) / GROWTH_SPEED;
    Object.assign(cell, { plant: type, wateredAt: Date.now() - ripeMs - 1000, nights });
    return true;
  }

  // Для сохранения: только клетки, где что-то есть
  toSave() {
    return this.cells
      .filter((cell) => cell.plant)
      .map(({ x, z, plant, wateredAt, nights }) => ({ x, z, plant, wateredAt, nights }));
  }

  load(saved) {
    const now = Date.now();
    for (const { x, z, plant, wateredAt, nights } of saved) {
      if (x >= 0 && x < GARDEN_SIZE && z >= 0 && z < GARDEN_SIZE && PLANTS[plant]) {
        Object.assign(this.cell({ x, z }), {
          plant,
          // сохранение с устройства, где часы спешат: время полива из «будущего» — считаем, что полили сейчас
          wateredAt: Number.isFinite(wateredAt) && wateredAt > 0 ? Math.min(wateredAt, now) : null,
          nights: Math.max(0, Number(nights) || 0),
        });
      }
    }
  }
}
