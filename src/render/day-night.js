// Как выглядит время суток: небо (со звёздами ночью), солнце и луна, рассеянный свет,
// дымка и растворение низа острова, отражения, цветокоррекция. Вид каждой части суток — config.js → DAYTIME,
// между ними всё плавно перетекает. Дождь приглушает свет поверх (сила дождя — от погоды).
import * as THREE from 'three';
import { DAYTIME, DAY_CYCLE, LIGHTING } from '../config.js';
import { skyUrl } from '../art/assets.js';
import { skyUniforms } from './sky-reflex.js';
import { gradientCanvas, averageColor, drawHalo, backdrop, environmentMap } from './lighting.js';

const SKY_SIZE = 512;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// Звёзды: точки разной яркости в верхней части неба (рисуются один раз)
function starsCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SKY_SIZE;
  const ctx = canvas.getContext('2d');
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rand() * SKY_SIZE;
    const y = rand() ** 1.6 * SKY_SIZE * 0.75; // гуще наверху, к горизонту — реже
    const bright = rand();
    ctx.fillStyle = `rgba(255, 248, 230, ${0.25 + bright * 0.6})`;
    const s = bright > 0.93 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  return canvas;
}

// Одна часть суток: картинка неба и цвета, которые из неё берутся
function prepareLook(id, renderer, onImage) {
  const cfg = DAYTIME[id];
  const look = { id, cfg, env: null };
  const useImage = (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SKY_SIZE;
    canvas.getContext('2d').drawImage(image, 0, 0, SKY_SIZE, SKY_SIZE);
    look.sky = canvas;
    look.top = averageColor(canvas, 0, 0.35);
    look.horizon = averageColor(canvas, 0.7, 1);
    look.hemiColor = look.top.clone().lerp(new THREE.Color(cfg.skyLight), 0.3); // свет сверху — в цвет неба
    look.env?.dispose();
    look.env = null; // отражения пересчитаются, когда понадобятся
    onImage?.();
  };
  useImage(gradientCanvas(cfg.sky, SKY_SIZE));
  // своя картинка: art/sky-<часть>.png (для вечера подходит и прежняя art/sky.png)
  const url = skyUrl(`sky-${id}`) || (id === 'evening' ? skyUrl('sky') : null);
  if (url) new THREE.ImageLoader().load(url, useImage);
  look.getEnv = () => {
    if (!look.env) look.env = environmentMap(renderer, look.sky, LIGHTING.groundColor);
    return look.env;
  };
  return look;
}

export function createDayNight({ renderer, scene, lighting, pipeline, weather, daytime }) {
  let skyReady = false;
  const looks = Object.fromEntries(Object.keys(DAYTIME).map((id) => [id, prepareLook(id, renderer, () => {
    if (skyReady) apply(true); // загрузилась своя картинка неба — перерисовать
  })]));
  const stars = starsCanvas();

  // Небо на экране — холст, который перерисовываем по ходу суток (несколько раз в секунду, не каждый кадр)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = skyCanvas.height = SKY_SIZE;
  const skyCtx = skyCanvas.getContext('2d');
  const skyTexture = backdrop(skyCanvas);
  scene.background = skyTexture;

  const state = { lamps: 1, stars: 0, night: 0, rays: 0, moonlight: 0 }; // для фонарей, лучей, светлячков и звуков
  const color = new THREE.Color();
  const color2 = new THREE.Color();
  let lastDraw = { from: null, to: null, t: -1, lamps: -1, rain: -1 };
  let lastLut = { from: null, to: null, t: -1 };
  let envLook = null;

  function drawSky(a, b, t, lamps, starsAmount) {
    skyCtx.globalAlpha = 1;
    skyCtx.drawImage(a.sky, 0, 0);
    if (t > 0.001) {
      skyCtx.globalAlpha = t;
      skyCtx.drawImage(b.sky, 0, 0);
    }
    if (starsAmount > 0.01) {
      skyCtx.globalAlpha = starsAmount;
      skyCtx.drawImage(stars, 0, 0);
    }
    skyCtx.globalAlpha = 1;
    drawHalo(skyCtx, SKY_SIZE, SKY_SIZE, lamps);
    skyTexture.needsUpdate = true;
  }

  function apply(force = false) {
    const { from, to, t } = daytime.blend();
    const a = looks[from];
    const b = looks[to];
    const mix = (key) => lerp(a.cfg[key], b.cfg[key], t);
    const rain = weather.intensity;

    // фонари загораются к вечеру и гаснут утром; звёзды — ночью
    state.lamps = mix('lamps');
    state.stars = mix('stars');
    // лучи держат силу всю часть суток (не разгораются вместе с солнцем), меняются только у границ;
    // ночью (от луны) — слабее: во столько, во сколько луна слабее солнца
    state.rays = daytime.steady((id) => DAYTIME[id].rays * Math.min(1, DAYTIME[id].sunIntensity / 2)) * (1 - rain);
    state.moonlight = mix('moonlight') * (1 - 0.7 * rain);
    state.night = from === 'night' ? 1 - t : to === 'night' ? t : 0;

    // небо (перерисовываем, только если заметно изменилось)
    const changed = from !== lastDraw.from || to !== lastDraw.to || Math.abs(t - lastDraw.t) > 0.004 || Math.abs(state.lamps - lastDraw.lamps) > 0.01 || Math.abs(rain - lastDraw.rain) > 0.02;
    if (force || changed) {
      drawSky(a, b, t, state.lamps, state.stars * (1 - rain)); // в дождь звёзды прячутся за тучами
      lastDraw = { from, to, t, lamps: state.lamps, rain };
    }

    // цвет горизонта — дымке, растворению низа острова, туману под островом
    const horizon = color.copy(a.horizon).lerp(b.horizon, t);
    scene.fog.color.copy(horizon);
    skyUniforms.uFadeColor.value.copy(horizon);
    skyUniforms.uSkyRim.value.copy(horizon).lerp(color2.copy(a.top).lerp(b.top, t), 0.3);
    scene.fog.near = LIGHTING.fogNear - 12 * rain;
    scene.fog.far = LIGHTING.fogFar - 35 * rain;

    // рассеянный свет неба
    lighting.hemi.color.copy(a.hemiColor).lerp(b.hemiColor, t);
    lighting.hemi.intensity = mix('skyLightIntensity') * (1 - 0.25 * rain);

    // солнце днём, луна ночью; у горизонта гаснут
    const sunU = daytime.sunPath();
    const moonU = daytime.moonPath();
    const u = sunU ?? moonU ?? 0;
    const peak = sunU !== null ? DAY_CYCLE.sunPeak : DAY_CYCLE.moonPeak;
    const elevation = peak * Math.sin(Math.PI * u) ** (sunU !== null ? 1.3 : 1);
    // дуга позади острова: утром — справа, днём — сзади (тени к зрителю, объёмнее), вечером — слева.
    // Спереди (со стороны зрителя) не светит никогда — иначе картинка плоская, без теней
    lighting.setSunDirection(135 + 160 * u, elevation);
    lighting.sun.color.copy(color.set(a.cfg.sun)).lerp(color2.set(b.cfg.sun), t);
    lighting.sun.intensity = mix('sunIntensity') * smooth(0, 6, elevation) * (1 - 0.6 * rain);

    // отражения: окружение от ближайшей части суток, сила — плавно
    const nearest = t < 0.5 ? a : b;
    if (nearest !== envLook || force) {
      scene.environment = nearest.getEnv();
      envLook = nearest;
    }
    scene.environmentIntensity = mix('reflections');

    // цветокоррекция
    if (force || from !== lastLut.from || to !== lastLut.to || Math.abs(t - lastLut.t) > 0.01) {
      pipeline.mixDaytimeLut(a.cfg.lut, b.cfg.lut, t);
      lastLut = { from, to, t };
    }
  }
  apply(true);
  skyReady = true;

  return {
    state,
    // Заранее посчитать отражения неба для всех частей суток (иначе считаются в момент смены — и картинка дёргается)
    prepare() {
      for (const look of Object.values(looks)) look.getEnv();
    },
    // Свет — каждый кадр (дёшево); небо и цветокоррекция — только когда заметно поменялись
    update() {
      apply(false);
    },
    refresh: () => apply(true), // после перемотки времени в панели G
  };
}
