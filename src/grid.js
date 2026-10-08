// Клетки: перевод «клетка ↔ место в сцене» и поиск пути по дорожкам.
import * as THREE from 'three';
import { GARDEN_SIZE, CELL_SIZE, BASKET_CELL } from './config.js';

const OFFSET = (GARDEN_SIZE - 1) / 2;

// Где в сцене центр клетки
export function cellToWorld(x, z) {
  return new THREE.Vector3((x - OFFSET) * CELL_SIZE, 0, (z - OFFSET) * CELL_SIZE);
}

// В какой клетке точка сцены
export function worldToCell(pos) {
  return {
    x: Math.round(pos.x / CELL_SIZE + OFFSET),
    z: Math.round(pos.z / CELL_SIZE + OFFSET),
  };
}

// Где точка сцены в клетках, без округления (дробные числа) — для расстояний
export function cellCoords(pos) {
  return { x: pos.x / CELL_SIZE + OFFSET, z: pos.z / CELL_SIZE + OFFSET };
}

export function isInGarden(c) {
  return c.x >= 0 && c.x < GARDEN_SIZE && c.z >= 0 && c.z < GARDEN_SIZE;
}

// Можно ли стоять на клетке: огород + дорожка вокруг, кроме корзинки
export function isWalkable(c) {
  const inArea = c.x >= -1 && c.x <= GARDEN_SIZE && c.z >= -1 && c.z <= GARDEN_SIZE;
  const isBasket = c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;
  return inArea && !isBasket;
}

// Кратчайший путь от клетки start до любой соседней с target клетки (например, к корзинке — на неё не встать).
// Возвращает список клеток (последняя — где встать) или null.
export function findPathToNeighbor(start, target) {
  const goals = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dz]) => ({ x: target.x + dx, z: target.z + dz }))
    .filter(isWalkable);
  return searchPath(start, goals);
}

// Кратчайший путь от клетки start до самой клетки target (встать на неё). Возвращает список клеток или null.
export function findPathTo(start, target) {
  return isWalkable(target) ? searchPath(start, [target]) : null;
}

function searchPath(start, goalCells) {
  const key = (c) => `${c.x},${c.z}`;
  const goals = new Set(goalCells.map(key));

  const cameFrom = new Map([[key(start), null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (goals.has(key(cur))) {
      const path = [];
      for (let c = cur; c; c = cameFrom.get(key(c))) path.unshift(c);
      return path;
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const next = { x: cur.x + dx, z: cur.z + dz };
        if (!isWalkable(next) || cameFrom.has(key(next))) continue;
        // По диагонали — только если не срезаем угол препятствия
        if (dx && dz && !(isWalkable({ x: cur.x + dx, z: cur.z }) && isWalkable({ x: cur.x, z: cur.z + dz }))) continue;
        cameFrom.set(key(next), cur);
        queue.push(next);
      }
    }
  }
  return null;
}
