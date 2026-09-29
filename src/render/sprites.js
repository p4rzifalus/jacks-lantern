// Спрайты: плоские пиксельные картинки в 3D-мире. Всегда повёрнуты к камере, стоят на земле,
// освещаются фонарями по своему рельефу (карте нормалей) и отбрасывают тень по форме рисунка.
import * as THREE from 'three';
import { GLOW } from '../config.js';
import { spriteNormalCanvas } from '../art/pixels.js';
import { userArtUrl } from '../art/assets.js';
import { registerSprite } from './view-angle.js';

export const PX = 1 / 30;             // размер одного пикселя спрайта в мире (≈30 пикселей на клетку)

function pixelTexture(canvas, colorSpace) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.magFilter = THREE.NearestFilter; // пиксели — чёткими квадратами
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

// Лист кадров: одна картинка со всеми кадрами, общий материал для всех спрайтов этого листа.
// name — имя для подмены своим рисунком (art/<name>.png), draw — как нарисовать лист кодом.
export function createSheet(name, draw, frameW, frameH, { glowStrength = 0.5 } = {}) {
  const pixelSheet = draw();
  const canvas = pixelSheet.toCanvas();
  const map = pixelTexture(canvas, THREE.SRGBColorSpace);
  const normalMap = pixelTexture(spriteNormalCanvas(canvas), THREE.NoColorSpace);
  const hasGlow = pixelSheet.glow.some(Boolean);
  const emissiveMap = hasGlow ? pixelTexture(pixelSheet.glowCanvas(), THREE.SRGBColorSpace) : null;

  const material = new THREE.MeshStandardMaterial({
    map, normalMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, metalness: 0,
    emissive: hasGlow ? '#ffffff' : '#000000', emissiveMap, emissiveIntensity: GLOW * glowStrength,
  });
  // тени по форме рисунка, а не прямоугольником
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  const distanceMaterial = new THREE.MeshDistanceMaterial({ map, alphaTest: 0.5 });

  // Свой рисунок из art/: тот же размер листа и тот же порядок кадров (см. ART.md)
  const url = userArtUrl(name);
  if (url) {
    new THREE.ImageLoader().load(url, (image) => {
      const own = document.createElement('canvas');
      own.width = image.width;
      own.height = image.height;
      own.getContext('2d').drawImage(image, 0, 0);
      map.image = own;
      map.needsUpdate = true;
      normalMap.image = spriteNormalCanvas(own);
      normalMap.needsUpdate = true;
    });
  }

  return {
    material, depthMaterial, distanceMaterial, frameW, frameH,
    cols: canvas.width / frameW,
    rows: canvas.height / frameH,
  };
}

export class Sprite {
  // faceCamera: false — для спрайта внутри другого, уже повёрнутого к камере (предмет в лапах героя)
  constructor(sheet, { castShadow = true, faceCamera = true } = {}) {
    this.sheet = sheet;
    const geometry = new THREE.PlaneGeometry(sheet.frameW * PX, sheet.frameH * PX);
    geometry.translate(0, (sheet.frameH * PX) / 2, 0); // низ картинки — на земле
    this.mesh = new THREE.Mesh(geometry, sheet.material);
    this.mesh.customDepthMaterial = sheet.depthMaterial;
    this.mesh.customDistanceMaterial = sheet.distanceMaterial;
    this.mesh.castShadow = castShadow;
    this.object = new THREE.Group(); // двигаем этот объект; внутри он всегда повёрнут к камере
    if (faceCamera) registerSprite(this.object); // повёрнут к камере, поворачивается вместе с ней
    this.object.add(this.mesh);
    this.col = -1;
    this.row = -1;
    this.setFrame(0, 0);
  }

  // Показать кадр: колонка и строка листа
  setFrame(col, row) {
    if (col === this.col && row === this.row) return;
    this.col = col;
    this.row = row;
    const { cols, rows } = this.sheet;
    const u0 = col / cols;
    const u1 = (col + 1) / cols;
    const v1 = 1 - row / rows;
    const v0 = 1 - (row + 1) / rows;
    const uv = this.mesh.geometry.attributes.uv;
    uv.setXY(0, u0, v1); // вверху слева
    uv.setXY(1, u1, v1);
    uv.setXY(2, u0, v0); // внизу слева
    uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }
}
