// Вид грядок: плитки земли и растения по стадиям. Читает состояние из GardenState.
// Ночью спелые растения настораживаются, пока по огороду ходит дух, и замахиваются при ударе.
import * as THREE from 'three';
import { GARDEN_SIZE, CELL_SIZE } from '../config.js';
import { getMaterial, projectUV } from '../art/assets.js';
import { cellToWorld } from '../grid.js';
import { EMPTY, RIPE } from '../garden.js';
import { Sprite } from '../render/sprites.js';
import { getSheets } from './sheets.js';
import { PLANT_ORDER, PLANT_FRAME } from '../art/sprite-art.js';

const STRIKE = 0.4; // сколько длится удар: первая половина — замах, вторая — сам удар

export class GardenView {
  constructor(scene, garden) {
    this.garden = garden;
    // Земля: сухая; мокрая — темнее и блестит; спелая — светлее, чтобы было видно, что пора собирать
    this.soil = {
      dry: getMaterial('soil'),
      wet: getMaterial('soil', { tint: '#5c5048', roughness: 0.5 }), // политая: заметно темнее и лишь чуть влажно блестит (сильный блеск днём отражает небо и светлеет)
      ripe: getMaterial('soil', { tint: '#f0d4a8' }),
    };
    this.cells = [];
    for (let x = 0; x < GARDEN_SIZE; x++) {
      for (let z = 0; z < GARDEN_SIZE; z++) {
        const p = cellToWorld(x, z);
        const tileGeo = projectUV(new THREE.BoxGeometry(CELL_SIZE * 0.92, 0.04, CELL_SIZE * 0.92), this.soil.dry.userData.units);
        const tile = new THREE.Mesh(tileGeo, this.soil.dry);
        tile.position.set(p.x, 0.02, p.z);
        tile.receiveShadow = true;
        scene.add(tile);

        const plant = new Sprite(getSheets().plants); // растение — пиксельный спрайт
        plant.object.position.set(p.x, 0.04, p.z);
        plant.object.visible = false;
        scene.add(plant.object);

        this.cells.push({ x, z, tile, plant, shownStage: null, shownType: null, strike: 0, phase: Math.random() * 2 });
      }
    }
  }

  // Растение на клетке c ударило духа — проиграть замах и удар
  strike(c) {
    const view = this.cells.find((v) => v.x === c.x && v.z === c.z);
    if (view) view.strike = STRIKE;
  }

  // Каждый кадр: обновить вид клеток. alert — по огороду ходит дух: спелые растения настороже
  update(now = Date.now(), dt = 0, alert = false) {
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
        let col = stage;
        let [sx, sy] = [1, 1];
        if (stage === RIPE && view.strike > 0) {
          view.strike = Math.max(0, view.strike - dt);
          const windup = view.strike > STRIKE * 0.55;
          col = windup ? PLANT_FRAME.windup : PLANT_FRAME.strike;
          [sx, sy] = windup ? [1.08, 0.92] : [0.94, 1.1]; // присел — распрямился
        } else if (stage === RIPE && alert) {
          const [first, count] = PLANT_FRAME.alert;
          col = first + (Math.floor(now / 400 + view.phase) % count);
        }
        view.plant.setFrame(col, PLANT_ORDER.indexOf(cell.plant));
        view.plant.mesh.scale.set(sx, sy, 1);
      }

      // Земля: тёмная, пока растёт после полива; светлая, когда урожай готов
      let soil = this.soil.dry;
      if (stage === RIPE) soil = this.soil.ripe;
      else if (cell.wateredAt) soil = this.soil.wet;
      view.tile.material = soil;
    }
  }
}
