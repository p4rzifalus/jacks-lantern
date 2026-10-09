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

  // Сторож кадров: если видеокарта не успевает — по шагу облегчает картинку. Обратно в той же игре не возвращает:
  // иначе картинка скачет туда-сюда (облегчил → стало гладко → вернул → снова рывки), это и было «ломано».
  // Шаги — от самого незаметного к заметному: затенение в углах → чёткость −0,25 → размытие краёв (tilt-shift) →
  // лучи света → чёткость дальше вниз (не ниже 0,75). Всё на лету, без перезагрузки.
  // Смотрим не на среднее, а на опоздавшие кадры: 15 % кадров по 33 мс в среднем почти незаметны, а глазу — рывки.
  // Уровень запоминаем: в следующий раз игра начнёт сразу с него. Раз в сутки пробует на шаг лучше —
  // вдруг тогда мешало что-то другое (браузер был занят, окно было меньше).
  const steps = [];
  if (ao) steps.push('ao');
  const dprSteps = [];
  for (let r = quality.maxDpr - 0.25; r >= 0.75 - 1e-6; r -= 0.25) dprSteps.push(r);
  if (dprSteps.length) steps.push(`dpr:${dprSteps.shift()}`);
  if (tiltPass) steps.push('tilt');
  steps.push('rays');
  for (const r of dprSteps) steps.push(`dpr:${r}`);
  const economy = { rays: true }; // лучи света рисует не конвейер, а light-rays.js — main.js спрашивает здесь
  const levelKey = `ogorod2-economy-${quality.name}`;
  const RETRY_MS = 24 * 3600 * 1000; // пробовать на шаг лучше — не чаще раза в сутки (каждая попытка — пара секунд рывков)
  let level = 0; // сколько шагов облегчения сейчас применено
  let triedAt = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(levelKey));
    if (Number.isFinite(saved?.level)) {
      const retry = Date.now() - saved.triedAt > RETRY_MS;
      level = Math.max(0, Math.min(steps.length, saved.level - (retry ? 1 : 0)));
      if (!retry) triedAt = saved.triedAt;
    }
  } catch { /* браузер не даёт читать или старая запись — начинаем с полного качества */ }
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
  function rememberLevel() {
    try {
      localStorage.setItem(levelKey, JSON.stringify({ level, triedAt }));
    } catch { /* не страшно */ }
  }
  applyLevel();
  rememberLevel();

  const WINDOW_MS = 2000; // замер — за 2 секунды
  const LATE_MS = 22;     // кадр дольше — опоздал (при 60 кадрах/с шаг 16,7 мс, опоздавший — 33 мс)
  const LATE_SHARE = 0.05; // опоздавших больше 5 % — облегчить
  let frames = 0;
  let late = 0;
  let prev = 0;
  let windowStart = 0;
  let settle = 1; // сколько замеров пропустить: после запуска и после облегчения картинка пересобирается
  // measure: false — кадры нарочно редкие (меню, 30 кадров/с): такие замеры не считаем
  function watchdog(now, measure) {
    if (!measure || document.hidden || now - prev > 250) { // меню, вкладка в фоне, долгая пауза — замер заново
      frames = 0;
      late = 0;
      windowStart = now;
      prev = now;
      return;
    }
    frames++;
    if (now - prev > LATE_MS) late++;
    prev = now;
    if (now - windowStart < WINDOW_MS) return;
    const share = late / frames;
    frames = 0;
    late = 0;
    windowStart = now;
    if (settle > 0) {
      settle--;
      return;
    }
    if (share > LATE_SHARE && level < steps.length) {
      level++;
      settle = 1;
      applyLevel();
      rememberLevel();
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
    composer, // для замеров (render/bench.js, консоль)
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
    // now — время кадра от браузера (requestAnimationFrame): по нему видно, когда кадр опоздал на экран.
    // performance.now() после отрисовки не годится — видеокарта доделывает кадр позже, и опоздание не видно
    render(dt, measure = true, now = performance.now()) {
      composer.render(dt);
      watchdog(now, measure);
    },
  };
}
