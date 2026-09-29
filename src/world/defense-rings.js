// Круги защиты: ночью вокруг спелых растений-защитников едва заметный круг — докуда они пугают духов.
// Когда растение прогоняет духа, его круг коротко вспыхивает.
import * as THREE from 'three';
import { PLANTS, CELL_SIZE, GARDEN_SIZE } from '../config.js';
import { cellToWorld } from '../grid.js';
import { RIPE } from '../garden.js';

// Мягкое кольцо: светлее у края круга, внутрь — прозрачнее
const material = () => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#ffcf8a') }, uStrength: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5) * 2.0;                       // 0 — центр, 1 — край круга
      float ring = smoothstep(0.8, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
      float fill = (1.0 - smoothstep(0.0, 1.0, r)) * 0.15;     // лёгкая заливка внутри
      gl_FragColor = vec4(uColor * (ring + fill) * uStrength, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});

export function createDefenseRings(scene, garden) {
  const rings = new Map(); // «x,z» → { mesh, flash }
  const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  for (let x = 0; x < GARDEN_SIZE; x++) {
    for (let z = 0; z < GARDEN_SIZE; z++) {
      const mesh = new THREE.Mesh(geometry, material());
      const at = cellToWorld(x, z);
      mesh.position.set(at.x, 0.03, at.z);
      mesh.renderOrder = 3;
      mesh.visible = false;
      scene.add(mesh);
      rings.set(`${x},${z}`, { mesh, flash: 0 });
    }
  }

  return {
    // night — насколько сейчас ночь (0…1): днём кругов нет
    update(dt, night) {
      for (const cell of garden.cells) {
        const r = rings.get(`${cell.x},${cell.z}`);
        r.flash = Math.max(0, r.flash - dt * 1.5);
        const on = cell.plant && garden.stage(cell) === RIPE && (night > 0.01 || r.flash > 0);
        r.mesh.visible = !!on;
        if (!on) continue;
        r.mesh.scale.setScalar(PLANTS[cell.plant].defense.radius * CELL_SIZE);
        r.mesh.material.uniforms.uStrength.value = 0.18 * night + 0.8 * r.flash;
      }
    },
    // растение прогнало духа — круг вспыхивает
    flash(c) {
      const r = rings.get(`${c.x},${c.z}`);
      if (r) r.flash = 1;
    },
  };
}
