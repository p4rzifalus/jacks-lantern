// Светящийся материал: цвет ярче белого (множитель GLOW), чтобы его подхватывало свечение (bloom).
// Свет и тени на него не действуют.
// Лампы (стекло фонарей, окна) днём гаснут: для них — отдельный список, яркость задаёт setLampLevel.
import * as THREE from 'three';
import { GLOW } from '../config.js';

const lamps = []; // { material, lit — цвет, когда горит; off — когда погашено }
const OFF = 0.3;  // погашенное стекло: просто тёплое тусклое стекло, без свечения

export function glowMaterial(color, strength = 1, { lamp = false } = {}) {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(GLOW * strength) });
  if (lamp) lamps.push({ material, lit: material.color.clone(), off: new THREE.Color(color).multiplyScalar(OFF) });
  return material;
}

// level: 0 — лампы погашены (день), 1 — горят (вечер и ночь)
export function setLampLevel(level) {
  for (const l of lamps) l.material.color.copy(l.off).lerp(l.lit, level);
}
