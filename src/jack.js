// Фонарь Джек — рассказчик. Реплики появляются внизу экрана с его портретом и именем и печатаются по буквам.
// Портрет (art/jack-art.js) шевелит «ртом», пока печатается реплика; днём Джек сонный, вечером и ночью — бодрый.
// Тексты — lines.js, паузы и частота — config.js → JACK.
// Первые события звучат по разу за игру (что уже сказано — say.toSave / load), атмосферные — изредка, утренняя — каждое утро.
import { JACK } from './config.js';
import { FIRST, AMBIENT, SLEEPY } from './lines.js';
import { createPortrait } from './art/jack-art.js';

// onType() — напечаталась буква (звук клавиши)
export function createJack({ onType }) {
  const box = document.createElement('div');
  box.className = 'jack';
  box.innerHTML = '<div class="jack-name title">Джек</div><div class="jack-text"></div>';
  const textNode = box.querySelector('.jack-text');
  const portrait = createPortrait();
  box.prepend(portrait.canvas);
  document.body.appendChild(box);
  let awake = true; // бодрый или сонный (см. setAwake)

  const said = new Set(); // какие первые события уже прозвучали
  const queue = [];       // что ещё сказать
  let line = null;        // { text, shown — сколько букв напечатано, hold — сколько ещё висеть после печати }
  let typed = 0;          // дробная часть напечатанного (печать идёт по времени)
  let quiet = JACK.ambientEvery[0]; // сколько ещё молчать до атмосферной реплики
  let lastAmbient = null;

  // Напечатанная часть видна, остальная — невидима, но место уже занимает: плашка не растёт и строки не прыгают
  const escape = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  function show() {
    textNode.innerHTML = `${escape(line.text.slice(0, line.shown))}<span class="jack-rest">${escape(line.text.slice(line.shown))}</span>`;
  }

  function next() {
    line = queue.length ? { text: queue.shift(), shown: 0, hold: JACK.holdSeconds } : null;
    typed = 0;
    if (line) show();
    box.classList.toggle('visible', !!line);
  }

  // Встать над рядом семян, если он открыт (иначе — над панелью инструментов)
  function place() {
    const seeds = document.querySelector('.seed-row.visible');
    const toolbar = document.querySelector('.toolbar');
    const top = seeds ? seeds.getBoundingClientRect().top : toolbar ? toolbar.getBoundingClientRect().top : window.innerHeight;
    box.style.bottom = `${Math.round(window.innerHeight - top + 10)}px`;
  }

  // Тап по реплике: допечатать сразу, а если уже напечатана — убрать
  box.addEventListener('click', () => {
    if (!line) return;
    if (line.shown < line.text.length) {
      line.shown = line.text.length;
      show();
    } else next();
  });

  const jack = {
    // Первое событие id (см. lines.js → FIRST): прозвучит, только если ещё не звучало
    first(id) {
      if (said.has(id) || !FIRST[id]) return;
      said.add(id);
      queue.push(FIRST[id]);
    },
    heard: (id) => said.has(id),

    // Сказать прямо этот текст (утренний итог ночи)
    say(text) {
      queue.push(text);
    },

    // Атмосферная реплика из набора kind ('morning', 'day', 'evening', 'night', 'rain'), если давно молчал
    ambient(kind, dt) {
      quiet -= dt;
      if (quiet > 0 || line || queue.length) return;
      const [min, max] = JACK.ambientEvery;
      quiet = min + Math.random() * (max - min);
      const pool = (AMBIENT[kind] || []).filter((t) => t !== lastAmbient);
      if (!pool.length) return;
      lastAmbient = pool[Math.floor(Math.random() * pool.length)];
      queue.push(lastAmbient);
    },

    // Разбудили днём: сонная реплика (если сейчас молчит)
    sleepy() {
      if (line || queue.length) return;
      const pool = SLEEPY.filter((t) => t !== lastAmbient);
      lastAmbient = pool[Math.floor(Math.random() * pool.length)];
      queue.push(lastAmbient);
    },

    // Бодрый (вечер, ночь, Джек у енота) или сонный (день) — так он выглядит на портрете
    setAwake(on) {
      awake = on;
    },

    get speaking() {
      return !!line || queue.length > 0;
    },

    // Каждый кадр. paused — открыто меню или окно: реплика ждёт и не видна
    update(dt, paused) {
      box.classList.toggle('paused', paused);
      if (paused) return;
      if (!line) {
        if (queue.length) next();
        if (!line) return;
      }
      place();
      portrait.update(dt, { talking: line.shown < line.text.length, awake });
      if (line.shown < line.text.length) {
        typed += dt * JACK.typeSpeed;
        while (typed >= 1 && line.shown < line.text.length) {
          typed -= 1;
          const ch = line.text[line.shown++];
          if (ch.trim()) onType();
        }
        show();
        return;
      }
      line.hold -= dt;
      if (line.hold <= 0) next();
    },

    // Для сохранения: что уже сказано
    toSave: () => [...said],
    load(list) {
      if (Array.isArray(list)) for (const id of list) if (FIRST[id]) said.add(id);
    },
  };
  return jack;
}
