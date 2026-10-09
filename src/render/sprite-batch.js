// Пачка спрайтов: много картинок одного листа — одной отрисовкой (и одной — в тенях). Так рисуются растения огорода.
// Каждый спрайт пачки ведёт себя как обычный Sprite (render/sprites.js): у него есть object.position, object.visible,
// mesh.scale, mesh.rotation.z и setFrame(col, row) — пачка раз в кадр (update) собирает их в общую картинку.
import * as THREE from 'three';
import { PX } from './sprites.js';
import { viewAngle } from './view-angle.js';

// Научить материал брать у каждого спрайта свой кадр листа: instanceFrame — левый нижний угол кадра на листе
function framedMaterial(material, sheet) {
  const m = material.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.frameSize = { value: new THREE.Vector2(1 / sheet.cols, 1 / sheet.rows) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec2 instanceFrame;\nuniform vec2 frameSize;')
      .replace('#include <uv_vertex>', `
        vec2 frameUv = instanceFrame + uv * frameSize;
        #undef MAP_UV
        #define MAP_UV frameUv
        #undef NORMALMAP_UV
        #define NORMALMAP_UV frameUv
        #undef EMISSIVEMAP_UV
        #define EMISSIVEMAP_UV frameUv
        #undef ALPHAMAP_UV
        #define ALPHAMAP_UV frameUv
        #include <uv_vertex>`);
  };
  m.customProgramCacheKey = () => `sprite-batch-${material.type}-${sheet.cols}x${sheet.rows}`;
  return m;
}

export class SpriteBatch {
  constructor(sheet, count, { castShadow = true } = {}) {
    this.sheet = sheet;
    const geometry = new THREE.PlaneGeometry(sheet.frameW * PX, sheet.frameH * PX);
    geometry.translate(0, (sheet.frameH * PX) / 2, 0); // низ картинки — на земле
    this.frames = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    geometry.setAttribute('instanceFrame', this.frames);

    this.mesh = new THREE.InstancedMesh(geometry, framedMaterial(sheet.material, sheet), count);
    this.mesh.customDepthMaterial = framedMaterial(sheet.depthMaterial, sheet);
    this.mesh.customDistanceMaterial = framedMaterial(sheet.distanceMaterial, sheet);
    this.mesh.castShadow = castShadow;
    this.mesh.frustumCulled = false; // спрайты разбросаны по огороду — проверять, виден ли каждый, дороже, чем рисовать
    this.items = [];
    for (let i = 0; i < count; i++) this.items.push(this.makeItem(i));

    this.matrix = new THREE.Matrix4();
    this.place = new THREE.Matrix4();
    this.turn = new THREE.Matrix4();
    this.lean = new THREE.Matrix4();
    this.size = new THREE.Matrix4();
  }

  // Один спрайт пачки — с теми же «ручками», что у обычного Sprite
  makeItem(i) {
    const batch = this;
    return {
      object: { position: new THREE.Vector3(), visible: true },
      mesh: { scale: new THREE.Vector3(1, 1, 1), rotation: { z: 0 } },
      col: -1,
      row: -1,
      setFrame(col, row) {
        if (col === this.col && row === this.row) return;
        this.col = col;
        this.row = row;
        const { cols, rows } = batch.sheet;
        batch.frames.setXY(i, col / cols, 1 - (row + 1) / rows);
        batch.frames.needsUpdate = true;
      },
    };
  }

  // Раз в кадр: положение, разворот к камере, наклон и сжатие каждого спрайта (невидимые — нулевого размера)
  update() {
    this.turn.makeRotationY(viewAngle.yaw);
    this.items.forEach((item, i) => {
      const { position, visible } = item.object;
      if (!visible) {
        this.matrix.makeScale(0, 0, 0);
      } else {
        const { scale, rotation } = item.mesh;
        this.place.makeTranslation(position.x, position.y, position.z);
        this.lean.makeRotationZ(rotation.z);
        this.size.makeScale(scale.x, scale.y, 1);
        this.matrix.copy(this.place).multiply(this.turn).multiply(this.lean).multiply(this.size);
      }
      this.mesh.setMatrixAt(i, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
