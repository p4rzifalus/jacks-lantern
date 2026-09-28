// Фонари: столбы по краям дорожки, фонарик на дереве, лампа у двери и свет из окон.
// Каждый — настоящий тёплый источник света; часть отбрасывает тени (сколько — зависит от качества).
import * as THREE from 'three';
import { LIGHTING, LANTERNS } from '../config.js';
import { glowMaterial } from '../render/glow.js';
import { getMaterial, mapTextures } from '../art/assets.js';
import { mergeStatic } from '../render/merge.js';

const iron = new THREE.MeshStandardMaterial({ color: '#2a2624', metalness: 0.6, roughness: 0.5 });

function lanternLight(color, intensity, distance, castShadow, quality) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.castShadow = castShadow;
  if (castShadow) {
    const size = Math.min(quality.shadowMap, 1024);
    light.shadow.mapSize.set(size, size);
    light.shadow.bias = -0.002;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 4;
    light.shadow.camera.near = 0.1;
    light.shadow.autoUpdate = false; // фонари не двигаются — тени обновляем изредка (см. update)
    light.shadow.needsUpdate = true;
  }
  return light;
}

// Конус света под фонарём: мягкое свечение в вечернем воздухе.
// Яркость спадает к земле и к краям конуса (края «размыты»), поэтому это не форма, а дымка света.
// Обычный предмет со своим простым шейдером — без дополнительных проходов.
const coneMaterial = () => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(LIGHTING.lanternColor).multiplyScalar(LIGHTING.coneStrength) } },
  vertexShader: /* glsl */ `
    varying vec3 vNormalView;
    varying float vHeight;
    void main() {
      vNormalView = normalize(normalMatrix * normal);
      vHeight = uv.y; // 1 — у фонаря, 0 — у земли
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying vec3 vNormalView;
    varying float vHeight;
    void main() {
      float facing = abs(vNormalView.z);          // к нам «лицом» — середина конуса, «ребром» — края
      float soft = pow(max(facing, 1e-4), 2.5);    // края тают (max — защита от «не-числа» на некоторых видеокартах)
      float fall = pow(max(vHeight, 1e-4), 1.8);   // к земле свет слабеет
      gl_FragColor = vec4(uColor * soft * fall, 1.0);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});

function lightCone(height, radius) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 24, 1, true), coneMaterial());
  cone.position.y = -height / 2; // вершина — у фонаря
  cone.castShadow = false;
  cone.renderOrder = 2;
  return cone;
}

// Фонарь: стекло светится, внутри — источник света; сверху шапочка
function lanternHead(scale = 1) {
  const head = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), glowMaterial(LIGHTING.lanternColor, 0.9));
  glass.castShadow = false; // не заслоняет собственный свет
  head.add(glass);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { // рёбра каркаса
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.025), iron);
    bar.position.set(x * 0.085, 0, z * 0.085);
    head.add(bar);
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 4), iron);
  cap.position.y = 0.16;
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  head.add(cap);
  head.scale.setScalar(scale);
  return head;
}

// Столб с фонарём
function post() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 8), getMaterial('wood', { tint: '#5a4230' }));
  pole.position.y = 0.75;
  pole.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), iron);
  arm.position.set(0, 1.45, 0.13);
  const head = lanternHead();
  head.position.set(0, 1.3, 0.26);
  group.add(pole, arm, head);
  mapTextures(group);
  mergeStatic(group);
  return { group, lightAt: new THREE.Vector3(0, 1.3, 0.26) };
}

export function createLanterns(scene, quality) {
  const lights = [];
  let shadowsLeft = quality.lanternShadows; // тени от фонарей дорогие — только у нескольких
  let lightsLeft = quality.lanternLights;   // на слабом качестве светят не все фонари

  const addLight = (position, color, intensity, distance, wantsShadow) => {
    if (lightsLeft-- <= 0) return;
    const castShadow = wantsShadow && shadowsLeft > 0;
    if (castShadow) shadowsLeft--;
    const light = lanternLight(color, intensity, distance, castShadow, quality);
    light.position.copy(position);
    scene.add(light);
    lights.push({ light, base: intensity, phase: Math.random() * 10 });
  };

  // Лампа у двери — первая, чтобы тень досталась ей
  addLight(LANTERNS.door, LIGHTING.lanternColor, LIGHTING.lanternIntensity * 0.35, LIGHTING.lanternDistance, true);

  // Столбы по краям дорожки, фонарь повёрнут к огороду
  for (const p of LANTERNS.posts) {
    const { group, lightAt } = post();
    group.position.set(p.x, 0, p.z);
    group.rotation.y = Math.atan2(-p.x, -p.z); // «рука» с фонарём смотрит к центру
    scene.add(group);
    if (quality.godRays) { // конус света — поверх склеенного столба, отдельно
      const cone = lightCone(1.25, 0.55);
      cone.position.add(new THREE.Vector3(0, 1.25, 0.26));
      group.add(cone);
    }
    group.updateMatrixWorld(true);
    addLight(lightAt.clone().applyMatrix4(group.matrixWorld), LIGHTING.lanternColor, LIGHTING.lanternIntensity, LIGHTING.lanternDistance, true);
  }

  // Фонарик на дереве, над качелями
  const hanging = lanternHead(0.8);
  hanging.position.copy(LANTERNS.tree);
  if (quality.godRays) {
    const cone = lightCone(1.4, 0.6);
    cone.position.y -= 0.1;
    hanging.add(cone);
  }
  scene.add(hanging);
  addLight(LANTERNS.tree, LIGHTING.lanternColor, LIGHTING.lanternIntensity * 0.6, LIGHTING.lanternDistance * 0.8, false);


  mapTextures(scene);

  let frame = 0;
  return {
    // где висят фонари — для пылинок в их свете
    positions: lights.map((l) => l.light.position.clone()),
    // Живой огонь: свет чуть подрагивает. Тени фонарей обновляются раз в 6 кадров (по очереди) —
    // двигается только герой, а каждая такая тень — это 6 перерисовок сцены.
    update(time) {
      frame++;
      lights.forEach((l, i) => {
        if (l.light.castShadow && (frame + i) % 6 === 0) l.light.shadow.needsUpdate = true;
      });
      for (const l of lights) {
        l.light.intensity = l.base * (0.92 + 0.05 * Math.sin(time * 7 + l.phase) + 0.03 * Math.sin(time * 13 + l.phase * 2));
      }
    },
  };
}
