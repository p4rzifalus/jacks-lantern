// Лучи света сквозь воздух: мягкие полосы от солнца (ночью — от луны), которые косо падают на остров
// и медленно «дышат». Сильнее всего — на рассвете; сила по времени суток — config.js → DAYTIME.rays.
// И лунное пятно: ночью над серединой огорода мягкий круг голубоватого света.
import * as THREE from 'three';
import { LIGHTING } from '../config.js';

const MIN_SLOPE = 38; // градусов над горизонтом — самый пологий наклон лучей

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float across = sin(3.14159 * vUv.x);                               // мягкие края полосы
  float along = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y)); // растворяется у земли и в вышине
  gl_FragColor = vec4(uColor * across * across * along * uStrength, 1.0);
}`;

export function createLightRays(scene, quality, lighting) {
  const { count, strength, length } = LIGHTING.rays;
  const rayCount = quality.godRays ? count : 0; // на слабом качестве лучей нет — только лунное пятно

  // Где лучи касаются земли: разбросаны по острову, у каждого своя ширина и своё «дыхание»
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rays = [];
  for (let i = 0; i < rayCount; i++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: { uColor: { value: new THREE.Color() }, uStrength: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    scene.add(mesh);
    rays.push({
      mesh,
      ground: new THREE.Vector3(-5 + rand() * 10, 0, -6 + rand() * 11),
      width: 0.9 + rand() * 1.8,
      phase: rand() * 10,
      speed: 0.15 + rand() * 0.25,
    });
  }

  // Лунное пятно: мягкий прожектор сверху на середину огорода (без теней — дёшево)
  const pool = new THREE.SpotLight(LIGHTING.moonPool.color, 0, 0, Math.atan(LIGHTING.moonPool.radius / 12), 1, 0);
  pool.position.set(0, 12, 0);
  pool.target.position.set(0, 0, 0);
  scene.add(pool, pool.target);

  const toSun = new THREE.Vector3();
  const view = new THREE.Vector3();
  const across = new THREE.Vector3();
  const corner = new THREE.Vector3();

  return {
    // amount — сила лучей 0..1, moonlight — сила лунного пятна 0..1
    update(time, camera, { amount, moonlight }) {
      pool.intensity = LIGHTING.moonPool.intensity * moonlight;
      pool.visible = moonlight > 0.01;

      const lightOn = amount > 0.01 && lighting.sun.intensity > 0.01;
      // направление — от солнца, но не положе MIN_SLOPE: у горизонта настоящие лучи легли бы плашмя на землю
      toSun.copy(lighting.sun.position).sub(lighting.sun.target.position);
      const flat = Math.hypot(toSun.x, toSun.z);
      toSun.set(toSun.x / flat, Math.max(Math.tan(THREE.MathUtils.degToRad(MIN_SLOPE)), toSun.y / flat), toSun.z / flat).normalize();
      camera.getWorldDirection(view);
      across.crossVectors(toSun, view).normalize(); // поперёк луча и взгляда — полоса всегда к нам лицом
      for (const r of rays) {
        r.mesh.visible = lightOn;
        if (!lightOn) continue;
        const pos = r.mesh.geometry.attributes.position;
        const half = r.width / 2;
        corner.copy(r.ground).addScaledVector(across, -half); pos.setXYZ(0, corner.x, corner.y, corner.z);
        corner.copy(r.ground).addScaledVector(across, half); pos.setXYZ(1, corner.x, corner.y, corner.z);
        corner.copy(r.ground).addScaledVector(toSun, length).addScaledVector(across, -half * 1.6); pos.setXYZ(2, corner.x, corner.y, corner.z);
        corner.copy(r.ground).addScaledVector(toSun, length).addScaledVector(across, half * 1.6); pos.setXYZ(3, corner.x, corner.y, corner.z);
        pos.needsUpdate = true;
        const breathe = 0.55 + 0.45 * Math.sin(time * r.speed + r.phase);
        const u = r.mesh.material.uniforms;
        u.uStrength.value = strength * amount * breathe * Math.min(1, lighting.sun.intensity / 2);
        u.uColor.value.copy(lighting.sun.color);
      }
    },
  };
}
