// Конвейер картинки: сцена рисуется в полном разрешении со сглаживанием краёв,
// поверх — свечение, тональная коррекция, цветокоррекция, виньетка, зерно.
import * as THREE from 'three';
import {
  EffectComposer, EffectPass, RenderPass,
  BloomEffect, TiltShiftEffect, KernelSize, ToneMappingEffect, ToneMappingMode, LUT3DEffect, VignetteEffect, NoiseEffect, BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { createLUTs, createLUTBlend } from './luts.js';

// settings — общий объект настроек (его меняет панель G)
export function createPipeline(renderer, scene, camera, settings, quality) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxDpr));
  renderer.toneMapping = THREE.NoToneMapping; // тональную коррекцию делает конвейер

  // HalfFloat — запас яркости сверх белого, чтобы свечение было «горячим»; multisampling — сглаживание краёв
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: quality.msaa });
  composer.addPass(new RenderPass(scene, camera));

  // Затенения в углах и там, где предметы касаются земли (только на хорошем качестве)
  let ao = null;
  if (quality.ao) {
    ao = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
    ao.configuration.distanceFalloff = 1;
    ao.configuration.halfRes = true; // считать в половинном размере — в разы быстрее, почти не видно
    ao.configuration.aoSamples = 8;    // меньше проб — быстрее
    ao.configuration.denoiseSamples = 4;
    composer.addPass(ao);
  }

  // Tilt-shift: верх и низ кадра мягко размыты — будто смотришь на маленькую диораму.
  // Отдельным проходом (размытие нельзя смешивать с другими размытиями в одном проходе)
  let tiltShift = null;
  let tiltPass = null;
  if (quality.tiltShift) {
    tiltShift = new TiltShiftEffect({ kernelSize: KernelSize.MEDIUM, resolutionScale: 0.5 });
    tiltPass = new EffectPass(camera, tiltShift);
    composer.addPass(tiltPass);
  }

  const bloom = new BloomEffect({ mipmapBlur: true, luminanceSmoothing: 0.2 });
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const luts = createLUTs();
  const autoLut = createLUTBlend(); // «auto» — цветокоррекция по времени суток (её смешивает day-night.js)
  autoLut.mix(luts.evening, luts.evening, 0);
  const pickLut = () => (settings.lut === 'auto' ? autoLut.texture : luts[settings.lut] || luts.evening);
  const lut = new LUT3DEffect(pickLut());
  const vignette = new VignetteEffect({ offset: 0.3 });
  const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  composer.addPass(new EffectPass(camera, bloom, toneMapping, lut, vignette, grain));

  // Перенести значения из настроек в эффекты (после каждого движения ползунка)
  function apply() {
    bloom.intensity = settings.bloomIntensity;
    bloom.luminanceMaterial.threshold = settings.bloomThreshold;
    bloom.mipmapBlurPass.radius = settings.bloomRadius;
    lut.lut = pickLut();
    lut.blendMode.opacity.value = settings.lutStrength;
    vignette.darkness = settings.vignette;
    grain.blendMode.opacity.value = settings.grain;
    if (tiltShift) {
      tiltShift.focusArea = settings.tiltFocus;
      tiltShift.feather = settings.tiltFeather;
      tiltShift.offset = settings.tiltOffset;
    }
    if (ao) {
      ao.configuration.intensity = settings.aoIntensity;
      ao.configuration.aoRadius = settings.aoRadius;
    }
  }
  apply();

  function resize() {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  resize();
  window.addEventListener('resize', resize);

  // Сторож кадров: если кадров мало — по шагу облегчает картинку, есть запас — так же по шагу возвращает.
  // Шаги — от самого незаметного к заметному: затенение в углах → лучи света → чёткость −0,25 →
  // размытие краёв (tilt-shift) → чёткость дальше вниз (не ниже 0,75). Всё на лету, без перезагрузки.
  // Меряем реальное время между кадрами за 2 секунды. Возвращаем осторожно: после 3 быстрых замеров подряд (6 с)
  // и не раньше чем через 30 с после облегчения — иначе картинка скачет туда-сюда.
  const steps = [];
  if (ao) steps.push('ao');
  steps.push('rays');
  const dprSteps = [];
  for (let r = quality.maxDpr - 0.25; r >= 0.75 - 1e-6; r -= 0.25) dprSteps.push(r);
  if (dprSteps.length) steps.push(`dpr:${dprSteps.shift()}`);
  if (tiltPass) steps.push('tilt');
  for (const r of dprSteps) steps.push(`dpr:${r}`);
  let level = 0; // сколько шагов облегчения сейчас применено
  const economy = { rays: true }; // лучи света рисует не конвейер, а light-rays.js — main.js спрашивает здесь
  function applyLevel() {
    const on = steps.slice(0, level);
    if (ao) ao.enabled = !on.includes('ao');
    if (tiltPass) tiltPass.enabled = !on.includes('tilt');
    economy.rays = !on.includes('rays');
    const dpr = on.filter((st) => st.startsWith('dpr:')).map((st) => Number(st.slice(4))).pop() ?? quality.maxDpr;
    const ratio = Math.min(window.devicePixelRatio, dpr);
    if (ratio !== renderer.getPixelRatio()) {
      renderer.setPixelRatio(ratio);
      resize();
    }
  }

  let frames = 0;
  let windowStart = performance.now();
  let fastWindows = 0;
  let loweredAt = -Infinity;
  // measure: false — кадры нарочно редкие (меню, 30 кадров/с): такие замеры не считаем
  function watchdog(now, measure) {
    if (!measure) {
      frames = 0;
      windowStart = now;
      return;
    }
    frames++;
    const elapsed = now - windowStart;
    if (elapsed < 2000) return;
    const frameMs = elapsed / frames;
    frames = 0;
    windowStart = now;
    if (document.hidden || frameMs > 500) return; // вкладка в фоне — не считается
    fastWindows = frameMs < 17.8 ? fastWindows + 1 : 0;   // держит полные 60 кадров/с
    if (frameMs > 22 && level < steps.length) {          // медленнее ~45 кадров/с — облегчить
      level++;
      loweredAt = now;
      applyLevel();
    } else if (fastWindows >= 3 && level > 0 && now - loweredAt > 30000) {
      level--;
      fastWindows = 0;
      applyLevel();
    }
  }

  return {
    apply,
    lutNames: ['auto', ...Object.keys(luts)],
    luts,
    // Смешать цветокоррекцию суток: от таблицы a к таблице b (имена из luts.js)
    mixDaytimeLut(a, b, t) {
      autoLut.mix(luts[a] || luts.evening, luts[b] || luts.evening, t);
    },
    get pixelRatio() {
      return renderer.getPixelRatio();
    },
    get raysOn() {
      return economy.rays;
    },
    // что сторож сейчас выключил (для панели G и замеров): «2 из 6»
    get economy() {
      return { ...economy, level, steps: steps.length, off: steps.slice(0, level) };
    },
    render(dt, measure = true) {
      composer.render(dt);
      watchdog(performance.now(), measure);
    },
  };
}
