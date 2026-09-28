// Туман под островом и вокруг: остров парит над ним.
//  • Море тумана — несколько горизонтальных слоёв на разной глубине. Рисунок облаков считается прямо в шейдере
//    из узора, который игра рисует сама при запуске, поэтому картинок не нужно; слои плывут с разной скоростью, а при повороте мира сдвигаются
//    друг относительно друга — так видна глубина.
//  • Клочья — мягкие облачка, которые медленно кружат у краёв острова, ниже уровня земли.
// Цвет туман берёт у неба (цвет горизонта, как у растворения низа острова), поэтому
// сам подстроится под другое небо и, позже, под смену дня и ночи.
import * as THREE from 'three';
import { FOG_SEA, LIGHTING } from '../config.js';
import { skyUniforms } from '../render/sky-reflex.js';
import { registerSprite } from '../render/view-angle.js';

const REACH = 70; // как далеко тянется туман от острова (дальше — плавно растворяется в небе)

const vertexShader = /* glsl */ `
varying vec2 vXZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vXZ = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;      // цвет горизонта
uniform vec3 uWarm;       // цвет фонарей
uniform vec2 uCenter;     // середина острова
uniform float uTime, uSpeed, uSize, uCloud, uDensity, uBright, uWarmGlow, uLayer, uSeed, uReach;
varying vec2 vXZ;

uniform sampler2D uNoise; // готовый узор облаков (бесшовный), см. noiseTexture

void main() {
  vec2 rel = vXZ - uCenter;
  float r = length(rel);
  // облака плывут; нижние слои — медленнее
  vec2 drift = vec2(1.0, 0.35) * uTime * uSpeed * (1.0 - 0.35 * uLayer);
  vec2 p = (vXZ + drift) / (uSize * 4.0) + uSeed;
  // узор + чуть «закрученный» мелкий слой, который плывёт иначе, — облака медленно меняют форму
  float warp = texture2D(uNoise, p * 0.5 + 0.37).r - 0.5;
  float n = texture2D(uNoise, p + warp * 0.15).r * 0.7 + texture2D(uNoise, p * 2.3 - drift * 0.02 / uSize).r * 0.3;

  // лёгкая дымка: полупрозрачная и почти ровная; море облаков: чёткие облака с разрывами
  float haze = uDensity * (0.25 + 0.35 * n);
  float edge = mix(0.68, 0.32, uDensity) - 0.06 * uLayer; // нижние слои плотнее — под облаками нет пустоты
  float cloud = smoothstep(edge, edge + 0.16, n) * (0.75 + 0.25 * uDensity);
  float alpha = mix(haze, cloud, uCloud);
  alpha *= 1.0 - smoothstep(uReach * 0.45, uReach, r); // вдали — растворяется в небе

  // верхушки облаков светлее, разрывы и нижние слои — темнее
  float lit = smoothstep(0.35, 0.95, n);
  vec3 col = uColor * (0.72 - 0.18 * uLayer) + (vec3(1.0, 0.95, 0.9) - uColor) * lit * uBright * (0.55 - 0.25 * uLayer);
  // тёплый отсвет фонарей острова сверху — сильнее на верхнем слое, прямо под островом
  col += uWarm * uWarmGlow * exp(-r * r / 90.0) * (1.0 - 0.7 * uLayer) * (0.5 + 0.5 * lit);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Бесшовный узор облаков (шум из нескольких слоёв), считается один раз при запуске
function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  let seed = 1234;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const octaves = [4, 8, 16, 32].map((cells) => ({ cells, grid: Array.from({ length: cells * cells }, rand) }));
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, total = 0;
      for (const { cells, grid } of octaves) {
        const fx = (x / size) * cells, fy = (y / size) * cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells; // по краям узор замыкается — без шва
        const sx = smooth(fx - x0), sy = smooth(fy - y0);
        const g = (i, j) => grid[j * cells + i];
        const top = g(x0, y0) + (g(x1, y0) - g(x0, y0)) * sx;
        const bottom = g(x0, y1) + (g(x1, y1) - g(x0, y1)) * sx;
        v += (top + (bottom - top) * sy) * amp;
        total += amp;
        amp *= 0.5;
      }
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round((v / total) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Мягкое облачко для клочьев: несколько размытых кругов на прозрачном фоне
function wispTexture(seed) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const g = canvas.getContext('2d');
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    const x = size * (0.2 + rand() * 0.6);
    const y = (size / 2) * (0.4 + rand() * 0.3);
    const r = size * (0.1 + rand() * 0.14);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// islandBounds — прямоугольник острова (вместе с краями)
export function createFogSea(scene, quality, islandBounds) {
  const settings = { ...FOG_SEA };
  const center = new THREE.Vector2((islandBounds.minX + islandBounds.maxX) / 2, (islandBounds.minZ + islandBounds.maxZ) / 2);
  const islandRadius = Math.hypot(islandBounds.maxX - islandBounds.minX, islandBounds.maxZ - islandBounds.minZ) / 2;

  // ---------- Море тумана ----------
  const time = { value: 0 };
  const shared = {
    uColor: skyUniforms.uFadeColor, // тот же объект: небо поменяется — туман следом
    uWarm: { value: new THREE.Color(LIGHTING.lanternColor) },
    uCenter: { value: center },
    uTime: time,
    uNoise: { value: noiseTexture() },
    uReach: { value: REACH },
    uSpeed: { value: 0 }, uSize: { value: 1 }, uCloud: { value: 0 }, uDensity: { value: 0 },
    uBright: { value: 0 }, uWarmGlow: { value: 0 },
  };
  const layers = [];
  const plane = new THREE.PlaneGeometry(REACH * 2, REACH * 2).rotateX(-Math.PI / 2);
  for (let i = 0; i < quality.fogLayers; i++) {
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: { ...shared, uLayer: { value: quality.fogLayers > 1 ? i / (quality.fogLayers - 1) : 0 }, uSeed: { value: i * 5.3 } },
      transparent: true, depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(plane, material);
    mesh.position.set(center.x, 0, center.y);
    mesh.renderOrder = -10 - i; // нижние слои рисуются первыми
    mesh.frustumCulled = false;
    scene.add(mesh);
    layers.push(mesh);
  }

  // ---------- Клочья у краёв ----------
  const wispMaterials = [1, 2, 3].map((k) => new THREE.MeshBasicMaterial({
    map: wispTexture(k * 7919), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(),
  }));
  const wispGeometry = new THREE.PlaneGeometry(1, 0.5);
  const wisps = [];
  for (let i = 0; i < quality.fogWisps; i++) {
    const holder = new THREE.Group(); // двигаем его; внутри облачко повёрнуто к камере
    const mesh = new THREE.Mesh(wispGeometry, wispMaterials[i % 3]);
    const size = 3 + (i * 1.7) % 2.5;
    mesh.scale.set(size, size, 1);
    registerSprite(mesh);
    holder.add(mesh);
    scene.add(holder);
    wisps.push({
      holder,
      angle: (i / quality.fogWisps) * Math.PI * 2 + (i % 2) * 0.4,
      radius: islandRadius * (1.05 + ((i * 0.37) % 0.35)),
      y: -0.4 - size * 0.25 - ((i * 0.53) % 1), // верх облачка — ниже земли, на огород не заходит
      speed: 0.15 + ((i * 0.11) % 0.15),
    });
  }

  function apply() {
    const u = shared;
    u.uSpeed.value = settings.speed;
    u.uSize.value = settings.size;
    u.uCloud.value = settings.cloudiness;
    u.uDensity.value = settings.density;
    u.uBright.value = settings.brightness;
    u.uWarmGlow.value = settings.warmGlow;
    layers.forEach((mesh, i) => { mesh.position.y = settings.top - i * settings.spacing; });
    wispMaterials.forEach((m) => { m.opacity = settings.wispOpacity; });
  }
  apply();

  return {
    settings,
    apply,
    update(dt) {
      time.value += dt;
      // клочья — светлее горизонта, как освещённый край облака
      const light = new THREE.Color(1, 0.95, 0.9);
      for (const m of wispMaterials) m.color.copy(skyUniforms.uFadeColor.value).lerp(light, 0.35 * settings.brightness);
      for (const w of wisps) {
        w.angle += w.speed * settings.speed * dt;
        w.holder.position.set(center.x + Math.cos(w.angle) * w.radius, w.y, center.y + Math.sin(w.angle) * w.radius);
      }
    },
  };
}
