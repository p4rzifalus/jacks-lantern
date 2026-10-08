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
  if (quality.tiltShift) {
    tiltShift = new TiltShiftEffect({ kernelSize: KernelSize.MEDIUM, resolutionScale: 0.5 });
    composer.addPass(new EffectPass(camera, tiltShift));
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

  // Сторож кадров: если кадр долгий — снижаем чёткость (не ниже 0.75), есть запас — возвращаем.
  // Меряем реальное время между кадрами за 2 секунды. Каждая смена чёткости — заметный рывок (все буферы картинки
  // создаются заново), поэтому возвращаем осторожно: только после 3 быстрых замеров подряд (6 с)
  // и не раньше чем через 30 с после снижения — иначе на быстрых экранах (120 Гц) чёткость скачет туда-сюда.
  let pixelRatio = renderer.getPixelRatio();
  let frames = 0;
  let windowStart = performance.now();
  let fastWindows = 0;
  let loweredAt = -Infinity;
  function watchdog(now) {
    frames++;
    const elapsed = now - windowStart;
    if (elapsed < 2000) return;
    const frameMs = elapsed / frames;
    frames = 0;
    windowStart = now;
    if (document.hidden || frameMs > 500) return; // вкладка в фоне — не считается
    let next = pixelRatio;
    fastWindows = frameMs < 14 ? fastWindows + 1 : 0;                     // быстрее ~70 кадров/с
    if (frameMs > 22) {                                                   // медленнее ~45 кадров/с
      next = Math.max(0.75, pixelRatio - 0.25);
      if (next !== pixelRatio) loweredAt = now;
    } else if (fastWindows >= 3 && now - loweredAt > 30000) {
      next = Math.min(quality.maxDpr, pixelRatio + 0.25);
      fastWindows = 0;
    }
    if (next !== pixelRatio) {
      pixelRatio = next;
      renderer.setPixelRatio(pixelRatio);
      resize();
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
      return pixelRatio;
    },
    render(dt) {
      composer.render(dt);
      watchdog(performance.now());
    },
  };
}
