// Звуковой «пульт»: три дорожки — действия, фон природы, музыка — и общая громкость.
// У каждой дорожки своё эхо (отзвук вечернего воздуха), поэтому выключение глушит и его.
// Браузер разрешает звук только после первого касания или клавиши — до этого всё молчит.
import { SOUND } from '../config.js';

const STORAGE_KEY = 'ogorod2-sound';
const BUSES = ['effects', 'ambience', 'music'];

// Что включено: «звуки» (действия + фон) и «музыка», и громкость каждого из меню (0…1).
// Запоминается в браузере.
function loadSwitches() {
  const on = { effects: true, music: true, effectsLevel: 1, musicLevel: 1 };
  try {
    Object.assign(on, JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch { /* нет сохранённого — всё включено */ }
  return on;
}

// Отзвук: шум, который плавно затухает, — как эхо на открытом воздухе
function reverbImpulse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

// Шум для шорохов, ветра и дождя: белый (шипит) и «коричневый» (гудит глухо, как ветер)
function noiseBuffers(ctx) {
  const length = ctx.sampleRate * 3;
  const white = ctx.createBuffer(1, length, ctx.sampleRate);
  const brown = ctx.createBuffer(1, length, ctx.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    w[i] = Math.random() * 2 - 1;
    last = (last + 0.02 * w[i]) / 1.02;
    b[i] = last * 3.5;
  }
  return { white, brown };
}

export function createAudioEngine() {
  const switches = loadSwitches();
  const volumes = { ...SOUND }; // панель G может менять на ходу
  const readyCallbacks = [];
  const changeCallbacks = [];
  const engine = {
    ctx: null,
    noise: null,
    volumes,
    mood: 1, // ночное настроение музыки: 1 — как днём, меньше — тише и медленнее
    dry: {},  // входы дорожек без эха
    wet: {},  // входы дорожек через эхо

    isOn: (name) => switches[name],
    toggle(name, on = !switches[name]) {
      switches[name] = on;
      changed();
    },
    // Громкость из меню: name — 'effects' или 'music', value — 0…1
    level: (name) => switches[`${name}Level`],
    setLevel(name, value) {
      switches[`${name}Level`] = value;
      if (value > 0) switches[name] = true; // подвинул ползунок — значит, хочет слышать
      changed();
    },
    onChange: (cb) => changeCallbacks.push(cb),

    // cb(ctx) вызовется, когда звук станет доступен (или сразу, если уже)
    onReady(cb) {
      if (engine.ctx) cb(engine.ctx);
      else readyCallbacks.push(cb);
    },

    // Громкость дорожек по переключателям и config.js — плавно, без щелчков
    applyVolumes() {
      const ctx = engine.ctx;
      if (!ctx) return;
      const target = {
        master: volumes.master,
        effects: switches.effects ? volumes.effects * switches.effectsLevel : 0,
        ambience: switches.effects ? volumes.ambience * switches.effectsLevel : 0,
        music: switches.music ? volumes.music * switches.musicLevel * engine.mood : 0,
      };
      for (const [name, value] of Object.entries(target)) {
        engine.gains[name].gain.setTargetAtTime(value, ctx.currentTime, 0.12);
      }
    },
  };

  function changed() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(switches));
    } catch { /* не страшно */ }
    start(); // нажатие на кнопку — тоже «первое касание»
    engine.applyVolumes();
    changeCallbacks.forEach((cb) => cb());
  }

  function start() {
    if (engine.ctx) {
      if (engine.ctx.state !== 'running' && !document.hidden) engine.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // очень старый браузер — играем молча
    const ctx = new AC();
    engine.ctx = ctx;
    engine.noise = noiseBuffers(ctx);

    // Мягкий ограничитель на выходе: монеты, дождь и музыка вместе не хрипят
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 4;
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(limiter);
    engine.gains = { master };

    const impulse = reverbImpulse(ctx, 2.6);
    for (const name of BUSES) {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(master);
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      reverb.connect(bus);
      engine.gains[name] = bus;
      engine.dry[name] = bus;
      engine.wet[name] = reverb;
    }

    engine.applyVolumes();
    readyCallbacks.splice(0).forEach((cb) => cb(ctx));
  }

  // Первое касание, клик или клавиша включает звук. Слушаем и дальше: iPhone иногда «усыпляет» звук.
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, start, { capture: true, passive: true });
  }

  // Вкладка скрыта — тишина; вернулись — звук снова
  document.addEventListener('visibilitychange', () => {
    if (!engine.ctx) return;
    if (document.hidden) engine.ctx.suspend();
    else engine.ctx.resume();
  });

  return engine;
}
