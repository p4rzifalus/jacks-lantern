// Музыка, которая сочиняется на ходу: тёплые аккорды, мягкий бас, перебор «гитары»
// и иногда мелодия «музыкальной шкатулки». Ноты каждый раз немного другие, поэтому не надоедает.
import { tone, rand, pick, noteHz } from './synth.js';

const BUS = 'music';
const AHEAD = 0.4; // на сколько секунд вперёд расписываем ноты

// Аккорды (ре мажор, вечернее настроение): бас и ноты аккорда. Каждый длится 2 такта.
const CHORDS = {
  D: { bass: 38, notes: [62, 66, 69, 73, 76] },   // ре мажор с септимой — «дом»
  Bm: { bass: 35, notes: [59, 62, 66, 69, 74] },  // си минор — чуть грустнее
  G: { bass: 43, notes: [59, 62, 66, 67, 71] },   // соль — тепло
  A: { bass: 45, notes: [57, 62, 64, 69, 71] },   // ля с задержанием — «хочется домой»
  Em: { bass: 40, notes: [59, 62, 64, 67, 71] },
  Fsm: { bass: 42, notes: [57, 61, 64, 66, 69] },
};
const PROGRESSIONS = [
  ['D', 'Bm', 'G', 'A'],
  ['D', 'G', 'Bm', 'A'],
  ['Em', 'Fsm', 'G', 'A'],
  ['G', 'D', 'Em', 'A'],
];
// Ноты для мелодии: пентатоника ре мажора (без острых углов — всё звучит мирно)
const MELODY = [69, 71, 74, 76, 78, 81, 83, 86];
// Как часто играет перебор на каждой восьмой такта
const ARP_CHANCE = [0.95, 0.35, 0.7, 0.45, 0.85, 0.35, 0.65, 0.5];
// Настроение куска из 8 тактов: только аккорды / аккорды с перебором / всё вместе
const SECTIONS = [
  { name: 'тихо', arp: 0.35, melody: 0 },
  { name: 'перебор', arp: 1, melody: 0.2 },
  { name: 'мелодия', arp: 0.8, melody: 0.7 },
];

export function createMusic(engine) {
  let nextTime = 0;   // когда звучит следующая восьмая
  let step = 0;       // номер восьмой внутри куска (8 тактов × 8)
  let progression = PROGRESSIONS[0];
  let section = SECTIONS[0];
  let arpIndex = 0;
  let melodyNote = 2; // где сейчас мелодия (номер в MELODY)
  let wasPlaying = false;

  const eighth = () => 30 / (engine.volumes.tempo * (0.85 + 0.15 * engine.mood)); // ночью чуть медленнее

  // Подушка аккорда: несколько слегка расстроенных голосов, медленно проступают и тают
  function pad(chord, when, length) {
    chord.notes.slice(0, 4).forEach((n, i) => {
      for (const detune of [-7, 7]) {
        tone(engine, BUS, {
          when, freq: noteHz(n - 12), type: 'sawtooth', detune, gain: 0.018, filter: 700 + i * 80,
          attack: 1.8, hold: Math.max(0, length - 1.8), decay: 2.5, pan: detune > 0 ? 0.3 : -0.3, reverb: 0.7,
        });
      }
    });
  }

  function bass(note, when, length) {
    tone(engine, BUS, { when, freq: noteHz(note), gain: 0.16, attack: 0.03, hold: length * 0.5, decay: length, filter: 400 });
  }

  // Щипок струны: яркое начало, быстро темнеет
  function pluck(note, when) {
    const f = noteHz(note);
    const pan = rand(-0.35, 0.35);
    tone(engine, BUS, { when, freq: f, type: 'triangle', gain: 0.07, attack: 0.003, decay: rand(0.9, 1.4), filter: 2400, pan, reverb: 0.35 });
    tone(engine, BUS, { when, freq: f * 2, gain: 0.02, attack: 0.002, decay: 0.25, pan });
  }

  // Колокольчик музыкальной шкатулки
  function bell(note, when) {
    const f = noteHz(note);
    const pan = rand(-0.4, 0.4);
    tone(engine, BUS, { when, freq: f, gain: 0.06, attack: 0.002, decay: 1.8, pan, reverb: 0.8 });
    tone(engine, BUS, { when, freq: f * 4.01, gain: 0.012, attack: 0.001, decay: 0.35, pan, reverb: 0.5 });
  }

  // Мелодия бродит по соседним нотам, изредка прыгает; на сильных долях тянется к нотам аккорда
  function nextMelodyNote(chord, strong) {
    melodyNote += pick([-2, -1, -1, 0, 1, 1, 2]);
    melodyNote = Math.max(0, Math.min(MELODY.length - 1, melodyNote));
    let note = MELODY[melodyNote];
    if (strong) {
      const fits = chord.notes.map((n) => n + 12).filter((n) => Math.abs(n - note) <= 2);
      if (fits.length) note = pick(fits);
    }
    return note;
  }

  // Одна восьмая: решаем, что прозвучит
  function play(when) {
    const bar = Math.floor(step / 8);
    const pos = step % 8;
    const chord = CHORDS[progression[Math.floor(bar / 2) % progression.length]];
    const e = eighth();

    if (step === 0) {
      section = pick(SECTIONS);
    }
    if (bar % 2 === 0 && pos === 0) pad(chord, when, e * 16);
    if (pos === 0) bass(chord.bass, when, e * 5);
    if (pos === 4 && Math.random() < 0.4) bass(chord.bass + 7, when, e * 3); // иногда — квинта на третьей доле

    // Перебор: вверх-вниз по нотам аккорда
    if (Math.random() < ARP_CHANCE[pos] * section.arp) {
      const notes = chord.notes;
      const i = arpIndex % (notes.length * 2 - 2);
      pluck(notes[i < notes.length ? i : notes.length * 2 - 2 - i], when + rand(0, 0.015));
    }
    arpIndex++;

    // Мелодия: короткие фразы, чаще на долях; последний такт куска — передышка
    if (bar < 7 && pos % 2 === 0 && Math.random() < section.melody * (pos === 0 ? 0.7 : 0.4)) {
      bell(nextMelodyNote(chord, pos === 0 || pos === 4), when);
    }

    step++;
    if (step >= 64) {
      step = 0;
      progression = pick(PROGRESSIONS);
    }
  }

  function schedule() {
    const ctx = engine.ctx;
    const playing = ctx && ctx.state === 'running' && engine.isOn('music');
    if (!playing) {
      wasPlaying = false;
      return;
    }
    if (!wasPlaying || nextTime < ctx.currentTime) {
      // включили (или вернулись во вкладку) — начинаем новый кусок, а не догоняем пропущенное
      wasPlaying = true;
      step = 0;
      nextTime = ctx.currentTime + 0.1;
    }
    while (nextTime < ctx.currentTime + AHEAD) {
      play(nextTime);
      nextTime += eighth();
    }
  }

  setInterval(schedule, 60);
}
