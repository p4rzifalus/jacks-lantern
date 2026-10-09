// Материалы с пиксельными текстурами. Текстура либо генерируется кодом (generate.js),
// либо берётся из твоего файла: положи art/<имя>.png (и по желанию art/<имя>_n.png — карту нормалей)
// в папку art/ в корне проекта — игра возьмёт его вместо сгенерированного. Имена — в ART.md.
import * as THREE from 'three';
import { TEXTURES, generateTexture, normalFromHeight, roughnessPixels } from './generate.js';
import { REALISTIC } from '../config.js';

// Все картинки из папки art/ (Vite находит их сам при запуске): PNG, JPG или WebP
const userArt = import.meta.glob('../../art/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
const userFile = (name) => ['png', 'jpg', 'jpeg', 'webp'].map((ext) => userArt[`../../art/${name}.${ext}`]).find(Boolean);
export const userArtUrl = userFile; // адрес твоей картинки из art/ (или undefined)

// Лёгкие копии для игры (npm run art → art/web/1024 и art/web/512) — браузер скачивает только нужный размер
const webArt = import.meta.glob('../../art/web/*/*.webp', { query: '?url', import: 'default', eager: true });
const webFile = (name, size) => webArt[`../../art/web/${size}/${name}.webp`];
// Небо — одного размера на всех (оно на весь экран); нет лёгкой копии — берём оригинал
export const skyUrl = (name) => webFile(name, 1024) || userFile(name);

function pixelTexture(pixels, size, colorSpace) {
  const tex = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;          // вблизи — чёткие пиксели
  tex.minFilter = THREE.LinearMipmapLinearFilter; // издалека — без ряби
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Микро-тени: впадины (низкая высота) получают меньше рассеянного света неба
function aoFromHeight(height) {
  const out = new Uint8ClampedArray(height.length * 4);
  for (let i = 0; i < height.length; i++) {
    const v = Math.min(1, 0.45 + height[i] * 0.75) * 255;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

// Рельеф и шероховатость из самой картинки: яркость = высота (светлое выступает, тёмное в щелях)
function mapsFromImage(image, strength) {
  const size = Math.min(512, textureLimit / 2); // рабочий размер: хватает для рельефа и считается быстро
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, size, size);
  const src = ctx.getImageData(0, 0, size, size).data;
  const wrap = (v) => (v + size) % size;
  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) lum[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  // лёгкое размытие, чтобы рельеф был «мягким», а не шумным
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += lum[wrap(y + dy) * size + wrap(x + dx)];
      height[y * size + x] = sum / 9;
    }
  }
  const normal = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  const h = (x, y) => height[wrap(y) * size + wrap(x)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      normal[i] = (-dx / len * 0.5 + 0.5) * 255;
      normal[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      normal[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
      const r = (0.95 - height[y * size + x] * 0.25) * 255; // выступы чуть глаже впадин
      rough[i] = rough[i + 1] = rough[i + 2] = r;
      rough[i + 3] = 255;
    }
  }
  return { normal, rough, ao: aoFromHeight(height), size };
}

// Реалистичная текстура: гладкое сглаживание, чёткость под углом
function smoothSettings(tex, colorSpace) {
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Шероховатость реалистичного материала: из config.js (черепица и мокрое — глаже, трава и кора — матовые)
const realisticRoughness = (name) => REALISTIC[name]?.roughness ?? 1;

// Текстуры реалистичной картинки: цвет, рельеф, шероховатость, затенение во впадинах.
// Одна загрузка на картинку, сколько бы материалов (оттенков) её ни брали — раньше каждый оттенок грузил и считал своё.
const realistic = new Map(); // имя → обещание { map, normalMap, roughnessMap, aoMap }
function realisticTextures(name, strength) {
  if (!realistic.has(name)) realistic.set(name, webFile(name, textureLimit) ? loadPrepared(name) : computeFromImage(name, strength));
  return realistic.get(name);
}

// Готовые файлы из art/web: всё посчитано заранее (npm run art) — браузеру остаётся только скачать
async function loadPrepared(name) {
  const loader = new THREE.TextureLoader();
  const load = (suffix, colorSpace) => loader.loadAsync(webFile(`${name}${suffix}`, textureLimit)).then((t) => smoothSettings(t, colorSpace));
  const [map, normalMap, roughnessMap, aoMap] = await Promise.all([
    load('', THREE.SRGBColorSpace), load('_n', THREE.NoColorSpace), load('_r', THREE.NoColorSpace), load('_ao', THREE.NoColorSpace),
  ]);
  return { map, normalMap, roughnessMap, aoMap };
}

// Лёгкой копии нет (новая картинка, npm run art ещё не запускали) — считаем из оригинала, как раньше
async function computeFromImage(name, strength) {
  const tex = await new THREE.TextureLoader().loadAsync(userFile(name));
  tex.image = fitImage(tex.image);
  const { normal, rough, ao, size } = mapsFromImage(tex.image, strength);
  return {
    map: smoothSettings(tex, THREE.SRGBColorSpace),
    aoMap: smoothSettings(new THREE.DataTexture(ao, size, size), THREE.NoColorSpace),
    normalMap: smoothSettings(new THREE.DataTexture(normal, size, size), THREE.NoColorSpace),
    roughnessMap: smoothSettings(new THREE.DataTexture(rough, size, size), THREE.NoColorSpace),
  };
}

// Подставить реалистичную картинку: цвет из файла, рельеф и шероховатость — из неё же (если нет своих _n/_r)
function loadRealistic(material, name, strength) {
  realisticTextures(name, strength).then((textures) => {
    const old = { map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap, aoMap: material.aoMap };
    Object.assign(material, textures);
    material.roughness = realisticRoughness(name) * material.userData.roughnessParam; // мокрая земля остаётся глаже
    material.needsUpdate = true;
    Object.values(old).forEach((t) => t.dispose()); // это были заглушки из кода — у каждого материала свои
    if (userFile(`${name}_n`)) replaceFromFile(material, 'normalMap', userFile(`${name}_n`));
    if (userFile(`${name}_r`)) replaceFromFile(material, 'roughnessMap', userFile(`${name}_r`));
  });
}

// Подменить текстуру материала картинкой из файла, когда она загрузится (с теми же настройками)
function replaceFromFile(material, slot, url) {
  new THREE.TextureLoader().load(url, (loaded) => {
    const old = material[slot];
    loaded.colorSpace = old.colorSpace;
    loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
    loaded.magFilter = THREE.NearestFilter;
    loaded.minFilter = THREE.LinearMipmapLinearFilter;
    material[slot] = loaded;
    material.needsUpdate = true;
    old.dispose();
  });
}

const cache = new Map();

// Предел размера реалистичных картинок (на слабом качестве — меньше: меньше памяти, быстрее старт)
let textureLimit = 1024;
export function setTextureLimit(size) {
  textureLimit = size;
}

// Уменьшить картинку, если она больше предела
function fitImage(image) {
  if (image.width <= textureLimit) return image;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = textureLimit;
  canvas.getContext('2d').drawImage(image, 0, 0, textureLimit, textureLimit);
  return canvas;
}

// Все созданные материалы с текстурами (для намокания под дождём)
export const allMaterials = () => cache.values();

// Материал по имени текстуры; tint — цвет, на который умножается текстура (для «нейтральных» текстур)
export function getMaterial(name, { tint = '#ffffff', roughness = 1, flatShading = false } = {}) {
  const key = `${name}|${tint}|${roughness}|${flatShading}`;
  if (cache.has(key)) return cache.get(key);

  const def = TEXTURES[name];
  const c = generateTexture(name);
  const map = pixelTexture(c.albedo, def.size, THREE.SRGBColorSpace);
  const normalMap = pixelTexture(normalFromHeight(c), def.size, THREE.NoColorSpace);
  const roughnessMap = pixelTexture(roughnessPixels(c), def.size, THREE.NoColorSpace);
  const aoMap = pixelTexture(aoFromHeight(c.height), def.size, THREE.NoColorSpace);
  const material = new THREE.MeshStandardMaterial({
    color: tint, map, normalMap, roughnessMap, aoMap, aoMapIntensity: 1, roughness, metalness: 0, flatShading,
  });
  const realistic = REALISTIC[name];
  if (userFile(name) && realistic) {
    loadRealistic(material, name, realistic.relief);
  } else {
    if (userFile(name)) replaceFromFile(material, 'map', userFile(name));
    if (userFile(`${name}_n`)) replaceFromFile(material, 'normalMap', userFile(`${name}_n`));
  }
  // сколько единиц сцены покрывает текстура — для разметки (у реалистичной картинки — свой масштаб)
  material.userData.roughnessParam = roughness;
  material.userData.units = userFile(name) && realistic ? realistic.units : def.units;
  cache.set(key, material);
  return material;
}

// Разметить поверхность под текстуру «коробочным» способом: каждая грань берёт две свои оси.
// Координаты — в единицах сцены, поэтому текстура везде одного размера и не тянется.
export function projectUV(geometry, units = 1) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) { u = pos.getX(i); v = pos.getZ(i); }
    else if (ax >= az) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv[i * 2] = u / units;
    uv[i * 2 + 1] = v / units;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.uvProjected = true;
  return geometry;
}

// Разметить все текстурированные предметы внутри объекта (кроме уже размеченных)
export function mapTextures(object) {
  object.traverse((m) => {
    const units = m.isMesh && m.material.userData?.units;
    if (units && !m.geometry.userData.uvProjected) projectUV(m.geometry, units);
  });
}

// Готовый предмет: форма + текстурированный материал, с тенями
export function texturedMesh(geometry, material) {
  if (material.userData.units) projectUV(geometry, material.userData.units);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
