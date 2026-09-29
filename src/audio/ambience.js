// Фон природы: ветер (порывы в такт с травой), шелест листвы; утром и днём — птицы,
// вечером и ночью — сверчки, ночью изредка сова; в дождь — шум и капли.
import { SOUND } from '../config.js';
import { tone, noise, noiseLoop, rand } from './synth.js';

const BUS = 'ambience';
const AHEAD = 0.3; // на сколько секунд вперёд расписываем сверчков

// Один сверчок: сидит где-то слева или справа, стрекочет фразами и замолкает
function makeCricket() {
  return { freq: rand(4200, 5400), pan: rand(-0.85, 0.85), gain: rand(0.012, 0.03), next: 0, left: 0 };
}

// «Цвирк»: три-четыре очень коротких импульса одной высоты
function chirp(engine, c, when) {
  const ctx = engine.ctx;
  const osc = ctx.createOscillator();
  osc.frequency.value = c.freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  const pulses = Math.random() < 0.5 ? 3 : 4;
  for (let i = 0; i < pulses; i++) {
    const t = when + i * 0.032;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(c.gain, t + 0.004);
    g.gain.linearRampToValueAtTime(0, t + 0.018);
  }
  const panner = ctx.createStereoPanner();
  panner.pan.value = c.pan;
  osc.connect(g).connect(panner).connect(engine.dry[BUS]);
  osc.start(when);
  osc.stop(when + pulses * 0.032 + 0.02);
}

// Птица: сидит где-то слева или справа, у каждой свой голос — высота и манера (посвист, трель, щебет)
function makeBird() {
  return { freq: rand(2300, 4200), pan: rand(-0.8, 0.8), gain: rand(0.015, 0.03), style: Math.floor(rand(0, 3)), next: rand(1, 6) };
}

// Одна фраза птицы: несколько коротких нот, каждая чуть «съезжает» по высоте
function birdPhrase(engine, b, when) {
  const notes = b.style === 1 ? Math.floor(rand(5, 9)) : Math.floor(rand(2, 5));
  let t = when;
  for (let i = 0; i < notes; i++) {
    const f = b.freq * rand(0.9, 1.12);
    if (b.style === 0) { // посвист: плавно вверх
      tone(engine, BUS, { when: t, freq: f * 0.8, freqEnd: f * 1.15, glide: 0.12, gain: b.gain, attack: 0.02, hold: 0.06, decay: 0.08, pan: b.pan, reverb: 0.4 });
      t += rand(0.18, 0.3);
    } else if (b.style === 1) { // трель: быстрые одинаковые ноты
      tone(engine, BUS, { when: t, freq: f, freqEnd: f * 0.92, glide: 0.04, gain: b.gain * 0.8, attack: 0.004, decay: 0.04, pan: b.pan, reverb: 0.3 });
      t += 0.06;
    } else { // щебет: коротко вниз
      tone(engine, BUS, { when: t, freq: f * 1.25, freqEnd: f * 0.85, glide: 0.07, gain: b.gain, attack: 0.005, decay: 0.07, pan: b.pan, reverb: 0.35 });
      t += rand(0.1, 0.2);
    }
  }
}

// Сова вдалеке: «у-у… у-у-у»
function owl(engine) {
  const t = engine.ctx.currentTime;
  const pan = rand(-0.7, 0.7);
  const base = rand(330, 380);
  [0, 0.55, 0.8].forEach((d, i) => {
    const hold = i === 0 ? 0.3 : 0.15;
    tone(engine, BUS, { when: t + d, freq: base * (i === 0 ? 1.04 : 1), freqEnd: base * 0.92, glide: hold + 0.2, gain: 0.05, attack: 0.06, hold, decay: 0.25, filter: 900, pan, reverb: 0.8 });
  });
}

export function createAmbience(engine) {
  let started = false;
  let wind, rustle, rain, rainLow;
  const crickets = [];
  const birds = Array.from({ length: 3 }, makeBird);
  let owlTimer = rand(...SOUND.owlEveryMinutes) * 60;

  function startLoops() {
    started = true;
    wind = noiseLoop(engine, BUS, { color: 'brown', type: 'lowpass', freq: 300, q: 0.5 });
    rustle = noiseLoop(engine, BUS, { color: 'white', type: 'highpass', freq: 4500, q: 0.4, pan: 0.3 });
    rain = noiseLoop(engine, BUS, { color: 'white', type: 'bandpass', freq: 2600, q: 0.35, reverb: 0.3 });
    rainLow = noiseLoop(engine, BUS, { color: 'brown', type: 'lowpass', freq: 450 });
    const count = Math.round(3 * SOUND.crickets);
    for (let i = 0; i < count; i++) crickets.push(makeCricket());
  }

  // windStrength — сила ветра (как гнётся трава), 0..~1.2; rain — сила дождя 0..1;
  // dark — темнота (0 — день, 1 — вечер и ночь), night — глубокая ночь 0..1
  return {
    update(dt, { windStrength, rain: rainAmount, dark = 1, night = 0 }) {
      const ctx = engine.ctx;
      if (!ctx || ctx.state !== 'running' || !engine.isOn('effects')) return; // звуки выключены — не тратим силы
      if (!started) startLoops();
      const t = ctx.currentTime;
      const smooth = 0.4; // за сколько секунд громкость догоняет цель

      // Ветер: гудит глуше или звонче вместе с порывами; листва шелестит только на сильных порывах
      const w = Math.max(0, windStrength);
      const loud = engine.volumes.wind; // config.js → SOUND.wind
      wind.volume.gain.setTargetAtTime(loud * (0.1 + 0.25 * w + 0.15 * rainAmount), t, smooth);
      wind.filter.frequency.setTargetAtTime(220 + 450 * w, t, smooth);
      rustle.volume.gain.setTargetAtTime(loud * 0.025 * w * w, t, smooth);

      // Дождь: шипение и глухой гул, плюс отдельные капли по листьям и доскам
      rain.volume.gain.setTargetAtTime(0.18 * rainAmount, t, 1);
      rainLow.volume.gain.setTargetAtTime(0.25 * rainAmount, t, 1);
      let drops = 25 * rainAmount * dt;
      while (drops > 0) {
        if (Math.random() < drops) {
          noise(engine, BUS, { when: t + rand(0, dt), type: 'bandpass', freq: rand(2000, 6000), q: 4, gain: rand(0.04, 0.12) * rainAmount, attack: 0.001, decay: 0.025, pan: rand(-0.8, 0.8) });
        }
        drops--;
      }

      // Птицы поют утром и днём, в дождь прячутся; чем светлее — тем чаще
      const song = (1 - dark) * (1 - rainAmount);
      for (const b of birds) {
        if (b.next < t) {
          if (song > 0.2) birdPhrase(engine, b, t + rand(0, 0.2));
          b.next = t + rand(3, 9) / Math.max(song, 0.2);
        }
      }

      // Сверчки: только в темноте, в дождь прячутся
      if (rainAmount < 0.5 && dark > 0.5) {
        for (const c of crickets) {
          if (c.next < t) c.next = t + rand(0, 2); // после паузы вкладки — не догоняем пропущенное
          while (c.next < t + AHEAD) {
            if (c.left > 0) {
              chirp(engine, c, c.next);
              c.left--;
              c.next += rand(0.3, 0.45);
            } else {
              c.left = Math.floor(rand(3, 10)); // сколько «цвирков» во фразе
              c.next += rand(1, 5);             // пауза между фразами
            }
          }
        }
      }

      // Сова ухает изредка, в дождь молчит
      owlTimer -= dt;
      if (owlTimer <= 0) {
        owlTimer = rand(...SOUND.owlEveryMinutes) * 60;
        if (rainAmount < 0.3 && night > 0.5) owl(engine); // только глубокой ночью
      }
    },
  };
}
