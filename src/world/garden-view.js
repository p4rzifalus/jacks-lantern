// Вид грядок: плитки земли и растения по стадиям. Читает состояние из GardenState.
// Сухие (отслужившие) — поникшие, бурые. Ночью спелые растения настораживаются, пока по огороду ходит дух, и замахиваются при ударе.
import * as THREE from 'three';
import { GARDEN_SIZE, CELL_SIZE, BASKET_CELL, PLANTS } from '../config.js';
import { getMaterial, projectUV } from '../art/assets.js';
import { cellToWorld } from '../grid.js';
import { EMPTY, RIPE } from '../garden.js';
import { Sprite } from '../render/sprites.js';
import { getSheets } from './sheets.js';
import { PLANT_ORDER, PLANT_FRAME } from '../art/sprite-art.js';

const STRIKE = 0.4; // сколько длится удар: первая половина — замах, вторая — сам удар
// Спелое растение тянется к ближайшему духу: замечает его за столько клеток сверх своей атаки, наклон — до LEAN радиан
const NOTICE = 1.5;
const LEAN = 0.35;
// Блеск мокрой земли (шероховатость: 1 — матовая, меньше — блестит): днём на солнце почти матовая,
// иначе одинаковые блики на всех грядках рябят; вечером и ночью влажно поблёскивает в свете фонарей
const WET_SHINE = { day: 0.9, night: 0.5 };
const WET_SKY_REFLECTION = 0.25; // сколько неба отражается в мокрой земле (1 — как в остальном мире)

// Мягкое тёплое пятно света на земле: им подсвечиваем, куда идти (первая грядка, большая корзина)
function glowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const glowMap = glowTexture();
function glowSpot(size, color = GUIDE_COLOR) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowMap, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  mesh.visible = false;
  return mesh;
}
const GUIDE_COLOR = '#ffc46a';
// След духа: где ночью что-то унесли — бледное голубое свечение на земле, тает за TRAIL_SECONDS (примерно к полудню)
const TRAIL_COLOR = '#8fb8ff';
const TRAIL_SECONDS = 150;

// У каждой грядки свой кусок текстуры (сдвиг и разворот на 180°), чтобы рисунок земли не повторялся клетка в клетку.
// Борозды остаются в одну сторону
function varyTopUV(geometry) {
  const uv = geometry.attributes.uv;
  const nor = geometry.attributes.normal;
  const [du, dv] = [Math.random(), Math.random()];
  const flip = Math.random() < 0.5 ? -1 : 1;
  for (let i = 0; i < uv.count; i++) {
    if (nor.getY(i) < 0.5) continue; // только верх грядки
    uv.setXY(i, flip * uv.getX(i) + du, flip * uv.getY(i) + dv);
  }
  return geometry;
}

export class GardenView {
  constructor(scene, garden) {
    this.garden = garden;
    // Земля: сухая; мокрая — темнее и блестит; спелая — светлее, чтобы было видно, что пора собирать
    this.soil = {
      dry: getMaterial('soil'),
      wet: getMaterial('soil', { tint: '#5c5048', roughness: WET_SHINE.day }), // политая: заметно темнее; блестит только при фонарях (см. setShine)
      ripe: getMaterial('soil', { tint: '#f0d4a8' }),
    };
    this.soil.wet.userData.skipWetness = true; // и так мокрая — дождь её блеск не трогает
    // небо в мокрой земле почти не отражается: иначе ночью политые грядки синеют, а на закате розовеют.
    // Блестит она от фонарей — тёплыми бликами
    this.soil.wet.envMapIntensity = WET_SKY_REFLECTION;
    this.cells = [];
    for (let x = 0; x < GARDEN_SIZE; x++) {
      for (let z = 0; z < GARDEN_SIZE; z++) {
        if (x === BASKET_CELL.x && z === BASKET_CELL.z) continue; // в центре — большая корзина, не грядка
        const p = cellToWorld(x, z);
        const tileGeo = varyTopUV(projectUV(new THREE.BoxGeometry(CELL_SIZE * 0.92, 0.04, CELL_SIZE * 0.92), this.soil.dry.userData.units));
        const tile = new THREE.Mesh(tileGeo, this.soil.dry);
        tile.position.set(p.x, 0.02, p.z);
        tile.receiveShadow = true;
        scene.add(tile);

        const plant = new Sprite(getSheets().plants); // растение — пиксельный спрайт
        plant.object.position.set(p.x, 0.04, p.z);
        plant.object.visible = false;
        scene.add(plant.object);

        this.cells.push({ x, z, tile, plant, shownStage: null, shownType: null, strike: 0, lean: 0, phase: Math.random() * 2 });
      }
    }

    // Подсказки светом: грядка, куда стоит пойти (в начале новой игры), и большая корзина, когда корзинка полна
    this.guide = glowSpot(CELL_SIZE * 1.3);
    this.guide.position.y = 0.05;
    this.basketCall = glowSpot(CELL_SIZE * 2.4);
    const b = cellToWorld(BASKET_CELL.x, BASKET_CELL.z);
    this.basketCall.position.set(b.x, 0.05, b.z);
    scene.add(this.guide, this.basketCall);
    this.scene = scene;
    this.trails = new Map(); // «x,z» → { mesh, t, cell }
  }

  // Дух унёс что-то с клетки c (или из корзины): на земле остаётся светящийся след
  trail(c) {
    const key = `${c.x},${c.z}`;
    let tr = this.trails.get(key);
    if (!tr) {
      const basket = c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;
      const mesh = glowSpot(CELL_SIZE * (basket ? 2 : 1.2), TRAIL_COLOR);
      const p = cellToWorld(c.x, c.z);
      mesh.position.set(p.x, 0.05, p.z);
      mesh.visible = true;
      this.scene.add(mesh);
      tr = { mesh, cell: c, basket };
      this.trails.set(key, tr);
    }
    tr.t = TRAIL_SECONDS;
  }

  // Подсветить грядку c (null — убрать): мягко пульсирует, пока на ней ничего не сделали
  setGuide(c) {
    this.guide.visible = !!c;
    if (c) {
      const p = cellToWorld(c.x, c.z);
      this.guide.position.set(p.x, 0.05, p.z);
    }
  }

  // Большая корзина зовёт (корзинка для сбора полна): тёплый свет вокруг неё
  setBasketCall(on) {
    this.basketCall.visible = on;
  }

  // Пульс подсветок и таяние следов духов (каждый кадр)
  pulse(time, dt = 0) {
    for (const [key, tr] of this.trails) {
      tr.t -= dt;
      if (tr.t <= 0) {
        this.scene.remove(tr.mesh);
        this.trails.delete(key);
        continue;
      }
      // на грядку вернули урожай (дух уронил) или посадили новое — след не нужен
      const covered = !tr.basket && this.garden.cell(tr.cell).plant;
      tr.mesh.visible = !covered;
      tr.mesh.material.opacity = 0.5 * Math.min(1, tr.t / 30) * (0.8 + 0.2 * Math.sin(time * 1.5 + tr.cell.x));
    }
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    this.guide.material.opacity = 0.25 + 0.35 * k;
    this.basketCall.material.opacity = 0.2 + 0.3 * k;
  }

  // Блеск мокрой земли по времени суток: lamps — насколько горят фонари (0 — день, 1 — вечер и ночь)
  setShine(lamps) {
    this.soil.wet.roughness = WET_SHINE.day + (WET_SHINE.night - WET_SHINE.day) * lamps;
  }

  // Растение на клетке c ударило духа — проиграть замах и удар
  strike(c) {
    const view = this.cells.find((v) => v.x === c.x && v.z === c.z);
    if (view) view.strike = STRIKE;
  }

  // Каждый кадр: обновить вид клеток. alert — по огороду ходит дух: спелые растения настороже;
  // spirits — где духи (точки сцены), right — направление «вправо» на экране (спелые тянутся к ближайшему духу)
  update(now = Date.now(), dt = 0, alert = false, spirits = [], right = null) {
    for (const view of this.cells) {
      const cell = this.garden.cell(view);
      const stage = this.garden.stage(view, now);
      if (stage !== view.shownStage || cell.plant !== view.shownType) {
        view.plant.object.visible = stage !== EMPTY;
        view.shownStage = stage;
        view.shownType = cell.plant;
        view.strike = 0;
      }
      if (stage !== EMPTY) {
        const dry = stage === RIPE && this.garden.isDry(view, now); // отслужил своё — засох, на духов не смотрит
        const guard = stage === RIPE && !dry;
        let col = dry ? PLANT_FRAME.dry : stage;
        if (stage === 0 && !this.garden.isWet(view, now)) col = PLANT_FRAME.thirsty; // семечко без воды — выцветшее
        if (guard && cell.nights > 0) col = PLANT_FRAME.wilted; // отстояло ночь — уставшее (ночью настороже — обычные кадры ниже)
        let [sx, sy] = [1, 1];
        if (guard && view.strike > 0) {
          view.strike = Math.max(0, view.strike - dt);
          const windup = view.strike > STRIKE * 0.55;
          col = windup ? PLANT_FRAME.windup : PLANT_FRAME.strike;
          [sx, sy] = windup ? [1.08, 0.92] : [0.94, 1.1]; // присел — распрямился
        } else if (guard && alert) {
          const [first, count] = PLANT_FRAME.alert;
          col = first + (Math.floor(now / 400 + view.phase) % count);
        }
        view.plant.setFrame(col, PLANT_ORDER.indexOf(cell.plant));
        view.plant.mesh.scale.set(sx, sy, 1);
        // наклон к ближайшему духу: чем ближе, тем сильнее; влево-вправо — как дух виден на экране
        let lean = 0;
        if (guard && right && spirits.length) {
          const at = view.plant.object.position;
          const notice = PLANTS[cell.plant].attack.reach + NOTICE;
          let near = null;
          let nearD = Infinity;
          for (const p of spirits) {
            const d = Math.hypot(p.x - at.x, p.z - at.z) / CELL_SIZE;
            if (d < nearD) { near = p; nearD = d; }
          }
          if (near && nearD < notice) {
            const side = ((near.x - at.x) * right.x + (near.z - at.z) * right.z) / Math.max(0.5, nearD * CELL_SIZE);
            lean = -LEAN * side * Math.min(1, 1.6 * (1 - nearD / notice)) + Math.sin(now / 160 + view.phase * 3) * 0.04; // и подрагивает
          }
        }
        view.lean += (lean - view.lean) * Math.min(1, dt * 6);
        view.plant.mesh.rotation.z = view.lean;
      }

      // Земля: тёмная, пока мокрая (полили или намочил дождь); светлая, когда урожай готов
      let soil = this.soil.dry;
      if (stage === RIPE) soil = this.soil.ripe;
      else if (this.garden.isWet(view, now)) soil = this.soil.wet;
      view.tile.material = soil;
    }
  }
}
