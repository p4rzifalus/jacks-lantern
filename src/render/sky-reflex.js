// Небо в свете острова — маленькая вставка в шейдер всех освещаемых материалов:
//  1) отсвет неба: поверхности, повёрнутые к нам «ребром», чуть окрашиваются в цвет неба
//     (так в жизни края предметов на закате ловят свет неба);
//  2) растворение в дымке: всё, что ниже уровня земли (обрывы, парящие плитки), плавно уходит в цвет неба у горизонта.
// Стоит одна-две строчки математики на пиксель — без дополнительных проходов.
import * as THREE from 'three';

export const skyUniforms = {
  uSkyRim: { value: new THREE.Color('#8a7aa8') },
  uSkyRimStrength: { value: 0.6 },
  uFadeColor: { value: new THREE.Color('#6a5060') },
  uFadeDepth: { value: 2.2 },     // на какой глубине под землёй растворение полное
  uFadeStrength: { value: 0.85 },
};

// Добавить вставку одному материалу (копия материала — clone() — вставку не переносит, её добавляют заново).
// Если у материала уже есть своя вставка (например, пачка спрайтов берёт каждому свой кадр) — наша идёт после неё
const patched = new WeakSet();
export function patch(material) {
  if (patched.has(material)) return;
  if (!(material.isMeshStandardMaterial || material.isMeshLambertMaterial)) return;
  patched.add(material);
  const own = material.hasOwnProperty('onBeforeCompile') ? material.onBeforeCompile : null;
  const ownKey = own ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (shader, renderer) => {
    own?.call(material, shader, renderer);
    Object.assign(shader.uniforms, skyUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSkyWorldY;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vec4 skyWorld = modelMatrix * vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    skyWorld = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  #endif
  vSkyWorldY = skyWorld.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vSkyWorldY;
uniform vec3 uSkyRim;
uniform float uSkyRimStrength;
uniform vec3 uFadeColor;
uniform float uFadeDepth;
uniform float uFadeStrength;`)
      .replace('#include <opaque_fragment>', `
  // отсвет неба на краях
  float skyRim = pow( max( 1.0 - saturate( dot( normal, geometryViewDir ) ), 1e-4 ), 3.0 );
  outgoingLight += uSkyRim * uSkyRimStrength * skyRim;
  // низ острова растворяется в дымке
  float skyFade = smoothstep( 0.0, uFadeDepth, -vSkyWorldY ) * uFadeStrength;
  outgoingLight = mix( outgoingLight, uFadeColor, skyFade );
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `${ownKey}|sky-reflex`;
  material.needsUpdate = true;
}

// Пройтись по сцене и добавить вставку всем новым материалам (уже обработанные пропускаются)
export function applySkyReflex(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach(patch);
  });
}
