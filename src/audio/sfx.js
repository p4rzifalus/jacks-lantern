// Звуки действий: посадка, полив, сбор, монеты, шаги героя, кнопки интерфейса.
// Всё собрано из тонов и шума (synth.js) — поменять звук = поменять числа здесь.
import { tone, noise, rand, noteHz } from './synth.js';

const FX = 'effects';

export function createSfx(engine) {
  // До первого касания звука нет — молча пропускаем
  const ready = () => engine.ctx && engine.ctx.state === 'running';
  const now = () => engine.ctx.currentTime;

  // Звон одной монетки: несколько «неровных» обертонов, как у металла
  function clink(when, pitch = 1, gain = 0.12) {
    const base = rand(2300, 2700) * pitch;
    [1, 2.76, 5.4].forEach((k, i) => {
      tone(engine, FX, { when, freq: base * k, gain: gain / (i + 1), decay: 0.35 / (i * 0.6 + 1), pan: rand(-0.2, 0.2), reverb: 0.25 });
    });
    noise(engine, FX, { when, type: 'highpass', freq: 5000, gain: gain * 0.5, decay: 0.03 });
  }

  const sfx = {
    // Посадка: лапки роют землю (два-три шороха) и мягкий «тук» семечка
    planted() {
      if (!ready()) return;
      const t = now();
      for (let i = 0; i < 3; i++) {
        noise(engine, FX, { when: t + i * 0.09 + rand(0, 0.02), color: 'brown', type: 'bandpass', freq: rand(500, 900), q: 0.8, gain: 0.5, attack: 0.01, decay: 0.09 });
      }
      tone(engine, FX, { when: t + 0.3, freq: 110, freqEnd: 55, glide: 0.1, gain: 0.35, decay: 0.14 });
    },

    // Полив: только бульканье — пузырьки капель, без шипения
    watered() {
      if (!ready()) return;
      const t = now();
      for (let i = 0; i < 22; i++) {
        const when = t + 0.12 + rand(0, 0.75);
        const f = rand(450, 1300);
        tone(engine, FX, { when, freq: f, freqEnd: f * rand(1.5, 2.2), glide: 0.03, gain: rand(0.04, 0.08), decay: 0.045, pan: rand(-0.3, 0.3) });
      }
    },

    // Сбор: шелест ботвы и сочный «чпок» — овощ выскочил из земли
    harvested() {
      if (!ready()) return;
      const t = now();
      noise(engine, FX, { when: t, type: 'highpass', freq: 3000, gain: 0.1, attack: 0.03, decay: 0.2 });
      tone(engine, FX, { when: t + 0.12, freq: 170, freqEnd: 620, glide: 0.07, gain: 0.35, decay: 0.1 });
      noise(engine, FX, { when: t + 0.12, color: 'brown', type: 'lowpass', freq: 700, gain: 0.35, decay: 0.08 });
      tone(engine, FX, { when: t + 0.2, freq: noteHz(84), type: 'triangle', gain: 0.05, decay: 0.4, reverb: 0.4 }); // тихий «дзинь» радости
    },

    // Продажа: монетки сыплются — чем дороже урожай, тем больше монет
    sold(price = 2) {
      if (!ready()) return;
      const t = now();
      noise(engine, FX, { when: t, color: 'brown', type: 'bandpass', freq: 400, gain: 0.3, decay: 0.12 }); // урожай лёг в корзинку
      const count = Math.max(2, Math.min(9, Math.round(1 + Math.log2(price + 1) * 1.5)));
      for (let i = 0; i < count; i++) clink(t + 0.12 + i * rand(0.05, 0.09), rand(0.9, 1.15), 0.1);
    },

    // Дух поднимается из тумана: тихое «у-у-у», будто ветер в трубе, с эхом
    spiritAppear() {
      if (!ready()) return;
      const t = now();
      const base = rand(420, 520);
      const pan = rand(-0.6, 0.6);
      tone(engine, FX, { when: t, freq: base * 0.8, freqEnd: base * 1.15, glide: 0.6, gain: 0.05, attack: 0.25, hold: 0.3, decay: 0.7, filter: 1400, pan, reverb: 0.9 });
      tone(engine, FX, { when: t + 0.05, freq: base * 1.2, freqEnd: base * 1.5, glide: 0.6, gain: 0.025, attack: 0.3, hold: 0.2, decay: 0.6, filter: 1800, pan, reverb: 0.9 });
    },

    // Дух схватил добычу: хихиканье «хи-хи-хи» — три коротких писка вниз
    spiritGrab() {
      if (!ready()) return;
      const t = now();
      const base = rand(1100, 1400);
      for (let i = 0; i < 3; i++) {
        tone(engine, FX, { when: t + i * 0.11, freq: base * (1 - i * 0.08), freqEnd: base * (0.85 - i * 0.08), glide: 0.07, type: 'triangle', gain: 0.05, attack: 0.005, decay: 0.08, reverb: 0.4 });
      }
    },

    // Дух испугался: короткое «ух!» вверх и вниз, растение отвечает мягким светлым звоном
    spiritScared() {
      if (!ready()) return;
      const t = now();
      const base = rand(600, 760);
      tone(engine, FX, { when: t, freq: base, freqEnd: base * 1.6, glide: 0.08, gain: 0.06, attack: 0.01, hold: 0.04, decay: 0.12, filter: 2200, reverb: 0.5 });
      tone(engine, FX, { when: t + 0.12, freq: base * 1.5, freqEnd: base * 0.7, glide: 0.25, gain: 0.05, attack: 0.01, decay: 0.3, filter: 1800, reverb: 0.6 });
      tone(engine, FX, { when: t + 0.05, freq: noteHz(88), type: 'triangle', gain: 0.04, decay: 0.8, reverb: 0.7 });
    },

    // Енот подобрал огонёк: тёплый звон с долгим эхом
    emberPicked() {
      if (!ready()) return;
      const t = now();
      [81, 88].forEach((n, i) => tone(engine, FX, { when: t + i * 0.07, freq: noteHz(n), type: 'triangle', gain: 0.06, decay: 0.9, reverb: 0.8 }));
    },

    // Дух улетает: мягкий шорох, уходящий вниз
    spiritLeave() {
      if (!ready()) return;
      noise(engine, FX, { when: now(), type: 'bandpass', freq: 1800, freqEnd: 600, q: 1.2, gain: 0.05, attack: 0.1, decay: 0.5, reverb: 0.5, pan: rand(-0.5, 0.5) });
    },

    // ---------- Бой ночью: растения бьют духов (всё тихое, чтобы ночь оставалась уютной) ----------

    // Морковь хлещет ботвой: свист-шорох и лёгкий шлепок
    plantWhip() {
      if (!ready()) return;
      const t = now();
      noise(engine, FX, { when: t, type: 'bandpass', freq: 900, freqEnd: 3200, q: 1.5, gain: 0.07, attack: 0.03, decay: 0.12, pan: rand(-0.3, 0.3) });
      noise(engine, FX, { when: t + 0.15, type: 'highpass', freq: 2500, gain: 0.05, decay: 0.04 });
    },

    // Редис выпускает искру: трескучий «пшик» вверх
    plantSpark() {
      if (!ready()) return;
      const t = now();
      for (let i = 0; i < 4; i++) noise(engine, FX, { when: t + i * rand(0.02, 0.04), type: 'highpass', freq: rand(3000, 5000), gain: 0.035, decay: 0.02 });
      tone(engine, FX, { when: t, freq: 500, freqEnd: 1600, glide: 0.12, type: 'triangle', gain: 0.03, decay: 0.14, filter: 2400, reverb: 0.3 });
    },

    // Тыква толкает: глухое «бум»
    plantThump() {
      if (!ready()) return;
      const t = now();
      tone(engine, FX, { when: t, freq: 110, freqEnd: 50, glide: 0.15, gain: 0.22, decay: 0.22 });
      noise(engine, FX, { when: t, color: 'brown', type: 'lowpass', freq: 500, gain: 0.2, decay: 0.12 });
    },

    // Подсолнух светит: мягкий звон с эхом
    plantBeam() {
      if (!ready()) return;
      const t = now();
      [79, 86, 91].forEach((n, i) => tone(engine, FX, { when: t + i * 0.04, freq: noteHz(n), type: 'triangle', gain: 0.03, attack: 0.02, decay: 0.7, reverb: 0.8 }));
    },

    // Гриб пускает споры: «пуф» и шелест
    plantSpores() {
      if (!ready()) return;
      const t = now();
      noise(engine, FX, { when: t, color: 'brown', type: 'lowpass', freq: 900, gain: 0.18, attack: 0.02, decay: 0.3 });
      noise(engine, FX, { when: t + 0.05, type: 'highpass', freq: 6000, gain: 0.025, attack: 0.1, decay: 0.5, reverb: 0.5 });
    },

    // Удар попал в духа: короткий звяк
    spiritHit() {
      if (!ready()) return;
      const t = now();
      const f = rand(1300, 1600);
      tone(engine, FX, { when: t, freq: f, freqEnd: f * 0.7, glide: 0.08, type: 'triangle', gain: 0.04, decay: 0.12, reverb: 0.3 });
    },

    // Открылись новые семена: короткое радостное арпеджио
    unlocked() {
      if (!ready()) return;
      const t = now() + 0.6; // после звона монет
      [72, 76, 79, 84].forEach((n, i) => {
        tone(engine, FX, { when: t + i * 0.11, freq: noteHz(n), type: 'triangle', gain: 0.12, decay: 0.6, reverb: 0.5 });
        tone(engine, FX, { when: t + i * 0.11, freq: noteHz(n) * 4, gain: 0.025, decay: 0.25 });
      });
    },

    // Получилось семя гибрида: волшебный перезвон. first — гибрид выведен впервые: дольше, с мерцанием
    hybrid(first) {
      if (!ready()) return;
      const t = now() + 0.15; // после звука сбора
      const notes = first ? [79, 83, 86, 91, 88, 95] : [86, 91];
      notes.forEach((n, i) => {
        const when = t + i * (first ? 0.13 : 0.09);
        tone(engine, FX, { when, freq: noteHz(n), type: 'sine', gain: first ? 0.1 : 0.07, decay: first ? 1.2 : 0.6, reverb: 0.7 });
        tone(engine, FX, { when, freq: noteHz(n) * 2.01, gain: 0.02, decay: 0.5, reverb: 0.7 }); // колокольчиковый обертон
      });
      if (first) noise(engine, FX, { when: t, type: 'highpass', freq: 6000, gain: 0.05, attack: 0.3, decay: 1.2, reverb: 0.6 }); // мерцание
    },

    // Шаг героя по песку: лёгкое «шшк» и россыпь песчинок, без низкого удара.
    // По грядке — чуть глуше и мягче, по дорожке — светлее и суше.
    step(onSoil) {
      if (!ready()) return;
      const g = engine.volumes.steps; // панель G меняет на ходу
      const t = now();
      const bright = onSoil ? 0.75 : 1; // грядка звучит ниже
      noise(engine, FX, { when: t, type: 'bandpass', freq: rand(2600, 3400) * bright, q: 0.8, gain: 0.3 * g, attack: 0.006, decay: 0.055 });
      const grains = onSoil ? 4 : 6;
      for (let i = 0; i < grains; i++) {
        noise(engine, FX, { when: t + rand(0, 0.045), type: 'bandpass', freq: rand(4000, 8000) * bright, q: 2, gain: rand(0.07, 0.16) * g, attack: 0.001, decay: rand(0.006, 0.012) });
      }
    },

    // Джек печатает реплику: тихий сухой щелчок клавиши, каждый чуть другой
    typeKey() {
      if (!ready()) return;
      noise(engine, FX, { type: 'bandpass', freq: rand(2600, 3800), q: 3, gain: rand(0.035, 0.05), attack: 0.001, decay: rand(0.012, 0.02) });
      tone(engine, FX, { freq: rand(900, 1300), type: 'triangle', gain: 0.012, decay: 0.02 });
    },

    // Кнопки: тихий деревянный щелчок
    click() {
      if (!ready()) return;
      tone(engine, FX, { freq: rand(1100, 1250), freqEnd: 700, glide: 0.03, type: 'triangle', gain: 0.07, decay: 0.04 });
    },

    // Магазин открылся (вверх) / закрылся (вниз)
    shop(open) {
      if (!ready()) return;
      const t = now();
      const notes = open ? [67, 74] : [74, 67];
      notes.forEach((n, i) => tone(engine, FX, { when: t + i * 0.08, freq: noteHz(n), type: 'triangle', gain: 0.09, decay: 0.25, filter: 2500, reverb: 0.2 }));
    },

    // Покупка: монетки отданы
    buy() {
      if (!ready()) return;
      const t = now();
      clink(t, 1.1, 0.06);
      clink(t + 0.07, 0.95, 0.05);
    },

    // «Так нельзя»: мягкий глухой звук, не ругается
    deny() {
      if (!ready()) return;
      const t = now();
      tone(engine, FX, { when: t, freq: 220, freqEnd: 170, glide: 0.12, type: 'triangle', gain: 0.1, decay: 0.14, filter: 900 });
      tone(engine, FX, { when: t + 0.09, freq: 180, freqEnd: 150, glide: 0.1, type: 'triangle', gain: 0.08, decay: 0.16, filter: 900 });
    },
  };
  return sfx;
}
