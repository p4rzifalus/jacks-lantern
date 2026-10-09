// Свет острова: солнце (ночью — луна), рассеянный свет неба, дымка вдали.
// Цвета и направление меняет смена дня и ночи (render/day-night.js); здесь — сами источники
// и помощники для неба: градиент, средний цвет, тёплый ореол, окружение для отражений.
import * as THREE from 'three';

const SUN_SHADOW_EVERY = 2; // тень солнца обновляется раз во столько кадров
import { LIGHTING } from '../config.js';
import { skyUniforms } from './sky-reflex.js';

// Небо-градиент: stops — [место 0..1, цвет] сверху вниз
export function gradientCanvas(stops, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, size);
  stops.forEach(([stop, color]) => g.addColorStop(stop, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// Средний цвет полосы картинки (from, to — доли высоты 0..1)
export function averageColor(canvas, from, to) {
  const small = document.createElement('canvas');
  small.width = small.height = 32;
  const ctx = small.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 32, 32);
  const data = ctx.getImageData(0, Math.floor(from * 32), 32, Math.max(1, Math.floor((to - from) * 32))).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  const n = data.length / 4;
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

// Тёплый ореол за островом — будто свет фонарей рассеивается в воздухе (рисуем поверх неба)
export function drawHalo(ctx, width, height, strengthScale = 1) {
  const { color, strength, x, y, radius } = LIGHTING.halo;
  const a = strength * strengthScale;
  if (a <= 0.001) return;
  const cx = x * width;
  const cy = y * height;
  const r = radius * Math.max(width, height);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const c = new THREE.Color(color);
  const rgba = (k) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${k})`;
  g.addColorStop(0, rgba(a));
  g.addColorStop(1, rgba(0));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Фон во весь экран без искажений (лишнее обрезается по краям)
export function backdrop(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const imageAspect = canvas.width / canvas.height;
  const fit = () => {
    const k = window.innerWidth / window.innerHeight / imageAspect;
    if (k > 1) { tex.repeat.set(1, 1 / k); tex.offset.set(0, (1 - 1 / k) / 2); }
    else { tex.repeat.set(k, 1); tex.offset.set((1 - k) / 2, 0); }
  };
  fit();
  window.addEventListener('resize', fit);
  return tex;
}

// Окружение для отражений: небо на верхней полусфере, снизу — тёмная земля. Считается один раз.
export function environmentMap(renderer, canvas, groundColor) {
  const envScene = new THREE.Scene();
  const skyTex = new THREE.CanvasTexture(canvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }),
  ));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(10, 24), new THREE.MeshBasicMaterial({ color: groundColor }));
  ground.rotation.x = -Math.PI / 2;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  skyTex.dispose();
  return env;
}

export function createLighting(renderer, scene, quality, islandBounds) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // мягкие края теней
  // Тени считаем сами, раз за кадр (shadowTick): иначе они пересчитываются при каждом проходе отрисовки,
  // а сцена за кадр рисуется не один раз (для затенения в углах — ещё раз)
  renderer.shadowMap.autoUpdate = false;

  // Рассеянный свет: сверху — небо, снизу — тёплый отсвет земли (цвет и силу задаёт смена дня и ночи)
  const hemi = new THREE.HemisphereLight('#ffffff', LIGHTING.groundColor, 1);
  scene.add(hemi);

  // Солнце (ночью — луна). Область теней — ровно по острову: так тени чётче при том же размере карты
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  const center = new THREE.Vector3((islandBounds.minX + islandBounds.maxX) / 2, 0, (islandBounds.minZ + islandBounds.maxZ) / 2);
  sun.target.position.copy(center);
  scene.add(sun.target);
  const reach = Math.hypot(islandBounds.maxX - islandBounds.minX, islandBounds.maxZ - islandBounds.minZ) / 2 + 0.5;
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  sun.shadow.autoUpdate = false; // солнце движется медленно — его тень обновляем через кадр (shadowTick)
  sun.shadow.bias = -0.0005;
  sun.shadow.intensity = LIGHTING.shadowStrength; // длинные закатные тени — полупрозрачные
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 50 });
  scene.add(sun);

  scene.fog = new THREE.Fog('#3a3450', LIGHTING.fogNear, LIGHTING.fogFar);
  skyUniforms.uSkyRimStrength.value = LIGHTING.skyReflex;
  skyUniforms.uFadeStrength.value = LIGHTING.bottomFade;

  return {
    sun,
    hemi,
    // Раз за кадр, перед отрисовкой: тени фонарей — когда фонарь попросил (lanterns.js), тень солнца — через кадр
    shadowTick(frame) {
      renderer.shadowMap.needsUpdate = true;
      sun.shadow.needsUpdate = frame % SUN_SHADOW_EVERY === 0;
    },
    // Откуда светит: azimuth — сторона (градусы), elevation — высота над горизонтом
    setSunDirection(azimuth, elevation) {
      const az = THREE.MathUtils.degToRad(azimuth);
      const el = THREE.MathUtils.degToRad(Math.max(elevation, 2)); // у самого горизонта тени бесконечные — держим чуть выше
      sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(25).add(center);
    },
  };
}
