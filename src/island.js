// Остров из плиток: ровная середина (огород, дорожка, домик), неровные края
// с рваными обрывами снизу и парящие отколовшиеся плитки вокруг.
import * as THREE from 'three';
import { getMaterial, projectUV } from './art/assets.js';

const TILE = 0.5; // размер плитки острова

// Где стоят большие детали. Под ними остров всегда есть (даже на краю).
export const FEATURES = {
  tree: { x: -3.4, z: -7.5 },
  boulders: [
    { x: 3.9, z: -7.7, r: 0.55 },
    { x: 4.7, z: -8.2, r: 0.3 },
    { x: 6.4, z: -2.2, r: 0.45 },
    { x: -6.4, z: 2.8, r: 0.35 },
  ],
  tallGrass: [
    { x: -4.7, z: -8.0 }, { x: -2.2, z: -8.2 }, { x: 3.2, z: -7.1 },
    { x: 6.5, z: -1.4 }, { x: -6.5, z: 3.6 }, { x: -6.6, z: -1.0 },
    { x: 1.5, z: 6.5 }, { x: 6.2, z: 4.4 },
  ],
};

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// core — прямоугольник, который должен быть целым (огород, дорожка, домик)
export function createIsland(scene, core) {
  const rand = seededRandom(42);

  // Плавная «волнистость» края, чтобы он был неровным, но не рябым
  const wobble = (x, z) =>
    0.5 + 0.28 * Math.sin(x * 1.1 + 1.7) * Math.cos(z * 0.9 + 0.4) + 0.22 * Math.sin((x + z) * 0.7 + 2.9);

  // Насколько точка дальше края середины (0 — внутри)
  const outside = (x, z) => {
    const dx = Math.max(core.minX - x, 0, x - core.maxX);
    const dz = Math.max(core.minZ - z, 0, z - core.maxZ);
    return Math.hypot(dx, dz);
  };
  const nearFeature = (x, z) => [FEATURES.tree, ...FEATURES.boulders, ...FEATURES.tallGrass]
    .some((f) => Math.hypot(x - f.x, z - f.z) < (f.r || 0.4) + 0.5);

  const tiles = [];
  const MARGIN = 1.6;
  for (let x = core.minX - MARGIN; x <= core.maxX + MARGIN; x += TILE) {
    for (let z = core.minZ - MARGIN; z <= core.maxZ + MARGIN; z += TILE) {
      const cx = x + TILE / 2;
      const cz = z + TILE / 2;
      const d = outside(cx, cz);
      const edge = d > 0;
      const keep = !edge || nearFeature(cx, cz) || (d < 0.15 + 1.2 * wobble(cx, cz) && rand() > 0.12);
      if (!keep) continue;
      // Края: плитки разной глубины (рваный низ), некоторые чуть просели
      const depth = edge ? 0.5 + rand() * 1.1 : 0.45 + rand() * 0.25;
      const top = edge && d > 0.3 && rand() < 0.3 ? -0.08 : 0;
      tiles.push({ x: cx, z: cz, top, depth });
    }
  }

  // Земля: верх — трава, бока — обрыв. Все плитки сливаются в две цельные поверхности,
  // разметка текстуры — в координатах мира, поэтому рисунок не повторяется плитка к плитке.
  const grass = getMaterial('grass');
  const cliff = getMaterial('cliff');
  const topPos = [];
  const topNor = [];
  const sidePos = [];
  const sideNor = [];
  for (const t of tiles) {
    const box = new THREE.BoxGeometry(TILE, t.depth, TILE).toNonIndexed();
    box.translate(t.x, t.top - t.depth / 2, t.z);
    const pos = box.attributes.position.array;
    const nor = box.attributes.normal.array;
    for (let i = 0; i < pos.length; i += 9) { // по треугольнику
      const isTop = nor[i + 1] > 0.5;
      (isTop ? topPos : sidePos).push(...pos.slice(i, i + 9));
      (isTop ? topNor : sideNor).push(...nor.slice(i, i + 9));
    }
  }
  const surface = (positions, normals, material) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    projectUV(geo, material.userData.units);
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  surface(topPos, topNor, grass);
  surface(sidePos, sideNor, cliff);

  const materials = [cliff, cliff, grass, cliff, cliff, cliff]; // для парящих плиток: грани x, x, верх, низ, z, z
  const geo = new THREE.BoxGeometry(1, 1, 1);
  projectUV(geo, 1);

  // Отколовшиеся плитки парят рядом с краем
  const flying = [];
  let attempts = 0;
  while (flying.length < 14 && attempts++ < 500) {
    const x = core.minX - MARGIN - 0.8 + rand() * (core.maxX - core.minX + 2 * MARGIN + 1.6);
    const z = core.minZ - MARGIN - 0.8 + rand() * (core.maxZ - core.minZ + 2 * MARGIN + 1.6);
    const d = outside(x, z);
    const edgeHere = 0.15 + 1.2 * wobble(x, z);
    if (d < edgeHere + 0.35 || d > edgeHere + 1.3 || nearFeature(x, z)) continue;
    const size = TILE * (0.5 + rand() * 0.5);
    const tile = new THREE.Mesh(geo, materials);
    tile.scale.set(size, size * (0.8 + rand() * 0.8), size);
    tile.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
    tile.castShadow = true;
    const baseY = -0.3 - rand() * 1.4;
    tile.position.set(x, baseY, z);
    flying.push({ mesh: tile, baseY, phase: rand() * 6, speed: 0.5 + rand() * 0.5 });
    scene.add(tile);
  }

  return {
    // Границы вместе с краями — чтобы камера показывала остров целиком
    bounds: {
      minX: core.minX - MARGIN - 1, maxX: core.maxX + MARGIN + 1,
      minZ: core.minZ - MARGIN - 1, maxZ: core.maxZ + MARGIN + 1,
    },
    update(time) {
      for (const f of flying) f.mesh.position.y = f.baseY + Math.sin(time * f.speed + f.phase) * 0.08;
    },
  };
}
