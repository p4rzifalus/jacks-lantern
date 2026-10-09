// Мелкие детали сцены: камни, травинки, цветы, ветер, флюгер, дым из трубы,
// летающие пушинки и брызги при поливе. На игру не влияют — только для настроения.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, BASKET_CELL, DECOR } from './config.js';
import { cellToWorld } from './grid.js';
import { FEATURES } from './island.js';

import { getMaterial, mapTextures } from './art/assets.js';
import { glowMaterial } from './render/glow.js';
import { mergeStatic } from './render/merge.js';
import { Sprite } from './render/sprites.js';
import { SpriteBatch } from './render/sprite-batch.js';
import { viewAngle } from './render/view-angle.js';
import { getSheets } from './world/sheets.js';
import { DECOR_FRAME } from './art/sprite-art.js';

// Какой цвет каким материалом: кора, камень, дерево; остальное — гладкий материал
const SURFACES = {
  [COLORS.treeTrunk]: () => getMaterial('bark'),
  [COLORS.boulder]: () => getMaterial('stone'),
  [COLORS.stone]: () => getMaterial('stone', { tint: '#e8e4dc' }),
  [COLORS.stoneDark]: () => getMaterial('stone', { tint: '#8a867e' }),
  [COLORS.swingSeat]: () => getMaterial('wood', { tint: COLORS.swingSeat }),
};
// один материал на цвет — так одинаковые предметы можно склеивать и рисовать быстрее
const plainMaterials = new Map();
const lambert = (color) => SURFACES[color]?.() ?? plainMaterials.get(color)
  ?? plainMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 })).get(color);

// Случайные числа, которые каждый раз одинаковые — детали не «прыгают» при перезагрузке
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDecor(scene, landmarks) {
  const rand = seededRandom(7);
  const between = (a, b) => a + rand() * (b - a);

  // Места для деталей: дорожка вокруг огорода и земля за домиком
  const spots = [];
  for (let x = -1; x <= GARDEN_SIZE; x++) {
    for (let z = -1; z <= GARDEN_SIZE; z++) {
      const onPath = x === -1 || z === -1 || x === GARDEN_SIZE || z === GARDEN_SIZE;
      const isBasket = x === BASKET_CELL.x && z === BASKET_CELL.z;
      if (onPath && !isBasket) spots.push(cellToWorld(x, z));
    }
  }
  const { island, house } = landmarks;
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Vector3(between(island.minX + 0.3, island.maxX - 0.3), 0, between(island.minZ + 0.3, house.maxZ - 0.6));
    const insideHouse = p.x > house.minX && p.x < house.maxX && p.z > house.minZ && p.z < house.maxZ;
    const nearTree = Math.hypot(p.x - FEATURES.tree.x, p.z - FEATURES.tree.z) < 1.2;
    const nearBoulder = FEATURES.boulders.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < b.r + 0.4);
    if (!insideHouse && !nearTree && !nearBoulder) spots.push(p);
  }
  function takeSpot() {
    if (!spots.length) return cellToWorld(-1, between(-1, GARDEN_SIZE)); // мест не хватило — на дорожку
    const p = spots.splice(Math.floor(rand() * spots.length), 1)[0].clone();
    p.x += between(-0.35, 0.35);
    p.z += between(-0.35, 0.35);
    return p;
  }

  // Камни (неподвижные — склеиваем в пару кусков, по одному на цвет)
  const stones = new THREE.Group();
  for (let i = 0; i < DECOR.stones; i++) {
    const r = between(0.1, 0.2);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), lambert(rand() < 0.5 ? COLORS.stone : COLORS.stoneDark));
    stone.position.copy(takeSpot()).setY(r * 0.3);
    stone.scale.y = 0.6;
    stone.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    stone.castShadow = false; // мелкие — без теней
    stones.add(stone);
  }
  scene.add(stones);
  mergeStatic(stones);

  // Травинки и цветы — пиксельные спрайты, качаются на ветру (наклон у основания).
  // Все вместе — одной пачкой (render/sprite-batch.js): собираем, где какие, а пачку делаем, когда все известны
  const decorSheet = getSheets().decor;
  const swaying = [];
  const plantSprite = (col, position, amount) => swaying.push({ col, position, phase: rand() * 6, amount });
  const pick = (list) => list[Math.floor(rand() * list.length)];
  for (let i = 0; i < DECOR.grassTufts; i++) plantSprite(pick(DECOR_FRAME.tufts), takeSpot(), 0.25);
  for (let i = 0; i < DECOR.flowers; i++) plantSprite(pick(DECOR_FRAME.flowers), takeSpot(), 0.15);

  // Флюгер на коньке крыши: стрелка поворачивается по ветру
  const vane = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), lambert(COLORS.vane));
  pole.position.y = 0.25;
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), lambert(COLORS.vane));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), lambert(COLORS.vane));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.44;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.22), lambert(COLORS.vane));
  tail.position.z = -0.3;
  arrow.add(shaft, tip, tail);
  arrow.position.y = 0.46;
  vane.add(pole, arrow);
  vane.position.copy(landmarks.roofPeak);
  vane.traverse((m) => { m.castShadow = true; });
  scene.add(vane);

  // Дым из трубы: пиксельные клубы поднимаются, растут, сносятся ветром и рассыпаются
  const puffs = [];
  for (let i = 0; i < DECOR.smokePuffs; i++) {
    const puff = new Sprite(getSheets().smoke, { castShadow: false });
    puffs.push({ sprite: puff, age: i / DECOR.smokePuffs });
    scene.add(puff.object);
  }

  // Пушинки летают над островом по ветру
  const fluffGeo = new THREE.SphereGeometry(0.035, 6, 4);
  // вечером пушинки — это светлячки: светятся и мерцают
  const fluffMat = glowMaterial(COLORS.firefly, 1.2);
  // все светлячки рисуются одной командой (InstancedMesh), у каждого своё место и мерцание
  const fireflies = new THREE.InstancedMesh(fluffGeo, fluffMat, DECOR.fireflies);
  scene.add(fireflies);
  const fireflyDummy = new THREE.Object3D();
  // Светлячок живёт так: появляется в случайном месте над травой, несколько секунд кружит
  // на одном месте, гаснет, отдыхает и появляется в другом месте
  const fluffs = [];
  const newFireflySpot = (f) => {
    f.center = new THREE.Vector3(between(island.minX + 0.5, island.maxX - 0.5), between(0.35, 1.1), between(island.minZ + 0.5, island.maxZ - 0.5));
    f.life = between(5, 9);       // сколько светит
    f.rest = between(2, 7);       // сколько отдыхает до следующего появления
    f.age = 0;
    f.radius = between(0.12, 0.3);
    f.spin = between(1, 2.2) * (rand() < 0.5 ? -1 : 1);
  };
  for (let i = 0; i < DECOR.fireflies; i++) {
    const f = { phase: rand() * 6 };
    newFireflySpot(f);
    f.age = -rand() * f.rest; // появляются не все сразу
    fluffs.push(f);
  }

  // Булыжники
  for (const b of FEATURES.boulders) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(b.r, 0), lambert(COLORS.boulder));
    boulder.position.set(b.x, b.r * 0.45, b.z);
    boulder.scale.set(1, 0.75, 0.9);
    boulder.rotation.set(rand(), rand() * 3, rand() * 0.4);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    scene.add(boulder);
  }

  // Высокая трава — пятнами из нескольких спрайтов
  for (const patch of FEATURES.tallGrass) {
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      plantSprite(pick(DECOR_FRAME.tall), new THREE.Vector3(patch.x + between(-0.35, 0.35), 0, patch.z + between(-0.35, 0.35)), 0.3);
    }
  }
  const grass = new SpriteBatch(decorSheet, swaying.length, { castShadow: false }); // мелочь без теней: почти не видно, а считать дорого
  swaying.forEach((s, i) => {
    s.item = grass.items[i];
    s.item.setFrame(s.col, 0);
    s.item.object.position.copy(s.position);
  });
  scene.add(grass.mesh);

  // Дерево с осенней листвой и качелями на ветке
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.3, 8), lambert(COLORS.treeTrunk));
  trunk.position.y = 1.15;
  tree.add(trunk);
  const branchDir = new THREE.Vector3(-1, 0, 1).normalize(); // ветка тянется влево по экрану — качели видно сбоку
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.2, 6), lambert(COLORS.treeTrunk));
  branch.position.set(branchDir.x * 0.6, 1.85, branchDir.z * 0.6);
  branch.rotation.set(Math.PI / 2 - 0.12, 0, 0);
  branch.rotation.order = 'YXZ';
  branch.rotation.y = -Math.PI / 4;
  tree.add(branch);
  for (const [cx, cy, cz, r, color] of [
    [0, 2.7, 0, 0.95, COLORS.leavesA], [-0.6, 2.4, -0.4, 0.75, COLORS.leavesB], [0.5, 2.35, -0.5, 0.7, COLORS.leavesB],
    [-0.3, 3.2, -0.2, 0.7, COLORS.leavesA], [0.35, 2.9, 0.35, 0.6, COLORS.leavesB], [-0.55, 2.8, 0.45, 0.55, COLORS.leavesA],
  ]) {
    const leafTint = color === COLORS.leavesA ? '#ffffff' : '#c89080'; // второй тон кроны — темнее и краснее
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), getMaterial('leaves', { tint: leafTint, flatShading: true }));
    clump.position.set(cx, cy, cz);
    tree.add(clump);
  }
  tree.traverse((m) => { m.castShadow = true; });
  tree.position.set(FEATURES.tree.x, 0, FEATURES.tree.z);
  scene.add(tree);

  // Качели: висят на ветке и раскачиваются поперёк неё
  const swingPivot = new THREE.Group();
  swingPivot.position.set(branchDir.x * 0.85, 1.85, branchDir.z * 0.85);
  swingPivot.rotation.y = (-3 * Math.PI) / 4; // своя ось x — вдоль ветки
  const swing = new THREE.Group();
  for (const side of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.35, 4), lambert(COLORS.rope));
    rope.position.set(side * 0.24, -0.68, 0);
    swing.add(rope);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.24), lambert(COLORS.swingSeat));
  seat.position.y = -1.37;
  swing.add(seat);
  swing.traverse((m) => { m.castShadow = true; });
  swingPivot.add(swing);
  tree.add(swingPivot);

  // Листья: немного, ветер носит их по всему острову, они кувыркаются и покачиваются
  const leafGeo = new THREE.PlaneGeometry(0.13, 0.09);
  const leafMats = [COLORS.leavesA, COLORS.leavesB, '#e0a040'].map((color) => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }));
  const leaves = [];
  for (let i = 0; i < DECOR.leaves; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]);
    leaf.position.set(between(island.minX, island.maxX), between(0.3, 2), between(island.minZ, island.maxZ));
    leaves.push({ mesh: leaf, phase: rand() * 6, speed: between(0.6, 1.1) });
    scene.add(leaf);
  }

  // Ветер: направление медленно гуляет, сила то нарастает, то стихает
  const wind = new THREE.Vector3();
  let windStrength = 0;

  mapTextures(scene); // разметить текстуры камней, дерева, качелей
  mergeStatic(tree, (o) => o === swingPivot); // дерево — одним куском, качели отдельно (они двигаются)

  return {
    // ветер — для дождя и частиц
    wind,
    get windStrength() {
      return windStrength;
    },
    fireflyVisibility: 1, // дождь гасит светлячков

    update(dt, time) {
      const angle = 0.8 + Math.sin(time * 0.05) * 1.2 + Math.sin(time * 0.13) * 0.4;
      windStrength = DECOR.wind * (0.6 + 0.4 * Math.sin(time * 0.4) + 0.2 * Math.sin(time * 1.7));
      wind.set(Math.sin(angle), 0, Math.cos(angle));

      // ветер «вправо по экрану» наклоняет спрайты вправо
      const windRight = wind.x * Math.cos(viewAngle.yaw) - wind.z * Math.sin(viewAngle.yaw);
      for (const s of swaying) {
        const lean = windStrength * s.amount * (0.7 + 0.3 * Math.sin(time * 2.2 + s.phase));
        s.item.mesh.rotation.z = -windRight * lean;
      }
      grass.update();

      // Флюгер смотрит по ветру, чуть подрагивает
      arrow.rotation.y = angle + Math.sin(time * 3.1) * 0.08 * windStrength;

      for (const p of puffs) {
        p.age = (p.age + dt / 4) % 1; // клуб живёт 4 секунды
        const t = p.age;
        p.sprite.object.position.copy(landmarks.chimneyTop)
          .add(new THREE.Vector3(wind.x * windStrength * t * 1.2, t * 1.4 - 0.2, wind.z * windStrength * t * 1.2));
        p.sprite.object.scale.setScalar(0.8 + t * 0.8);               // клуб растёт
        p.sprite.setFrame(Math.min(3, Math.floor(t * 4)), 0);          // и рассыпается по кадрам
      }

      fluffs.forEach((f, i) => {
        f.age += dt;
        if (f.age > f.life + f.rest) newFireflySpot(f);
        // плавно загорается и гаснет, в середине чуть мерцает
        const lit = f.age > 0 && f.age < f.life ? Math.sin((Math.PI * f.age) / f.life) : 0;
        const glow = lit * (0.75 + 0.25 * Math.sin(time * 6 + f.phase)) * this.fireflyVisibility;
        // кружит вокруг своей точки, покачиваясь вверх-вниз
        const a = time * f.spin + f.phase;
        fireflyDummy.position.set(
          f.center.x + Math.cos(a) * f.radius,
          f.center.y + Math.sin(time * 1.7 + f.phase) * 0.08,
          f.center.z + Math.sin(a) * f.radius,
        );
        fireflyDummy.scale.setScalar(Math.max(glow, 0.001));
        fireflyDummy.updateMatrix();
        fireflies.setMatrixAt(i, fireflyDummy.matrix);
      });
      fireflies.instanceMatrix.needsUpdate = true;

      // Качели: мягко качаются, сильнее при ветре
      swing.rotation.x = Math.sin(time * 1.6) * (0.12 + windStrength * 0.15);

      for (const l of leaves) {
        const p = l.mesh.position;
        p.addScaledVector(wind, windStrength * l.speed * dt);
        p.y += Math.sin(time * 1.1 + l.phase) * 0.25 * dt;
        l.mesh.rotation.set(time * 2 + l.phase, time * 1.3 + l.phase, 0); // кувыркается
        // улетел за край острова — прилетает с другой стороны
        if (p.x > island.maxX + 1) p.x = island.minX - 1;
        if (p.x < island.minX - 1) p.x = island.maxX + 1;
        if (p.z > island.maxZ + 1) p.z = island.minZ - 1;
        if (p.z < island.minZ - 1) p.z = island.maxZ + 1;
      }

    },
  };
}
