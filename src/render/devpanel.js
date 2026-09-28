// Панель настройки картинки (клавиша G) и счётчик кадров. Временная — в финале уберём.
// Значения запоминаются в браузере; «скопировать значения» — чтобы вписать их в config.js.
import GUI from 'lil-gui';
import { FX, QUALITY } from '../config.js';
import { HERO_SKINS } from '../art/sprite-art.js';
import { rememberQuality } from './quality.js';

const STORAGE_KEY = 'ogorod2-fx';

export function loadFxSettings(quality) {
  const settings = { ...FX };
  if (!import.meta.env.DEV) return settings; // в опубликованной игре — ровно как в config.js
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch { /* нет сохранённого — берём из config.js */ }
  return settings;
}

export function createDevPanel(settings, pipeline, quality, weather, audio, getHero) {
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* не страшно */ }
  };
  const changed = () => {
    pipeline.apply();
    save();
  };

  const gui = new GUI({ title: 'Картинка (G — скрыть)' });
  const fps = { value: '—' };
  gui.add(fps, 'value').name('кадров в секунду').disable().listen();
  const sharp = { value: '—' };
  gui.add(sharp, 'value').name('чёткость (сторож)').disable().listen();

  const q = { level: quality.name };
  gui.add(q, 'level', Object.keys(QUALITY)).name('качество').onChange((name) => {
    rememberQuality(name);
    location.reload(); // тени и разрешение меняются только с перезагрузкой
  });

  const glow = gui.addFolder('Свечение');
  glow.add(settings, 'bloomIntensity', 0, 4, 0.05).name('сила').onChange(changed);
  glow.add(settings, 'bloomThreshold', 0, 2, 0.01).name('порог яркости').onChange(changed);
  glow.add(settings, 'bloomRadius', 0, 1, 0.01).name('размах').onChange(changed);

  const tilt = gui.addFolder('Миниатюра (tilt-shift)');
  tilt.add(settings, 'tiltFocus', 0.1, 1.5, 0.01).name('резкая полоса').onChange(changed);
  tilt.add(settings, 'tiltFeather', 0, 1, 0.01).name('мягкость края').onChange(changed);
  tilt.add(settings, 'tiltOffset', -0.5, 0.5, 0.01).name('сдвиг полосы').onChange(changed);

  const shade = gui.addFolder('Затенения в углах');
  shade.add(settings, 'aoIntensity', 0, 6, 0.1).name('сила').onChange(changed);
  shade.add(settings, 'aoRadius', 0.1, 4, 0.05).name('радиус').onChange(changed);

  const color = gui.addFolder('Цвет');
  color.add(settings, 'lut', pipeline.lutNames).name('цветокоррекция').onChange(changed);
  color.add(settings, 'lutStrength', 0, 1, 0.05).name('сила коррекции').onChange(changed);
  color.add(settings, 'vignette', 0, 1, 0.05).name('виньетка').onChange(changed);
  color.add(settings, 'grain', 0, 0.5, 0.01).name('зерно').onChange(changed);

  if (getHero) {
    // Выбор героя — только для проверки; постоянный выбор — config.js → HERO_SKIN
    const names = { енот: 'raccoon', крот: 'mole' };
    const who = { skin: null };
    gui.add(who, 'skin', Object.fromEntries(Object.entries(names).filter(([, s]) => HERO_SKINS.includes(s))))
      .name('герой').onChange((skin) => getHero().setSkin(skin));
    queueMicrotask(() => { who.skin = getHero().skin; gui.controllersRecursive().forEach((c) => c.updateDisplay()); });
  }

  if (weather) {
    const sky = gui.addFolder('Погода');
    sky.add({ rain: () => weather.setRain(true) }, 'rain').name('дождь сейчас');
    sky.add({ clear: () => weather.setRain(false) }, 'clear').name('ясно');
  }

  if (audio) {
    // Громкости не запоминаются: подобрал — «скопировать громкости» и впиши в config.js → SOUND
    const vol = gui.addFolder('Звук');
    const apply = () => audio.applyVolumes();
    vol.add(audio.volumes, 'master', 0, 1, 0.05).name('общая').onChange(apply);
    vol.add(audio.volumes, 'effects', 0, 1, 0.05).name('действия').onChange(apply);
    vol.add(audio.volumes, 'ambience', 0, 1, 0.05).name('природа').onChange(apply);
    vol.add(audio.volumes, 'music', 0, 1, 0.05).name('музыка').onChange(apply);
    vol.add(audio.volumes, 'steps', 0, 1, 0.05).name('шаги');
    vol.add(audio.volumes, 'wind', 0, 1, 0.05).name('ветер');
    vol.add(audio.volumes, 'tempo', 40, 100, 1).name('темп мелодии');
    vol.add({
      copy() {
        const text = JSON.stringify(audio.volumes, null, 2);
        navigator.clipboard?.writeText(text);
        console.log(text);
      },
    }, 'copy').name('скопировать громкости');
  }

  gui.add({
    copy() {
      const text = JSON.stringify(settings, null, 2);
      navigator.clipboard?.writeText(text);
      console.log(text);
    },
  }, 'copy').name('скопировать значения');
  gui.add({
    reset() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch { /* нечего чистить */ }
      location.reload();
    },
  }, 'reset').name('сбросить к config.js');
  gui.hide();

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyG') (gui._hidden ? gui.show() : gui.hide());
  });

  // Счётчик кадров: считаем кадры за секунду
  let frames = 0;
  let since = performance.now();
  return {
    tick(now) {
      frames++;
      if (now - since >= 1000) {
        fps.value = String(Math.round((frames * 1000) / (now - since)));
        sharp.value = `${pipeline.pixelRatio}×`;
        frames = 0;
        since = now;
      }
    },
  };
}
