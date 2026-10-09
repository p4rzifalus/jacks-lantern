// Вступление новой игры: три кадра прямо на острове — камера сама переезжает, внизу карточка с текстом.
// Тексты и кадры — lines.js → STORY. Тап (или пробел) — допечатать / дальше, «пропустить» — сразу в игру.
import { STORY } from './lines.js';
import { JACK } from './config.js';
import { createPortrait } from './art/jack-art.js';

const CAMERA_PAUSE = 1.1; // сколько секунд камера едет к кадру, прежде чем появится текст

// onShot(shot, instant) — поставить камеру на кадр; onType() — напечаталась буква реплики Джека; onDone() — в игру
export function createIntro({ onShot, onType, onDone }) {
  const box = document.createElement('div');
  box.className = 'jack story';
  box.innerHTML = '<div class="jack-name title"></div><div class="jack-text"></div><button class="story-skip">пропустить</button>';
  const portrait = createPortrait();
  box.prepend(portrait.canvas);
  const nameNode = box.querySelector('.jack-name');
  const textNode = box.querySelector('.jack-text');
  document.body.appendChild(box);

  let active = false;
  let step = -1;
  let shown = 0;  // сколько букв напечатано
  let typed = 0;  // дробная часть (печать идёт по времени)
  let wait = 0;   // пауза перед текстом, пока едет камера

  const current = () => STORY[step];
  const escape = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  function show() {
    const { text } = current();
    textNode.innerHTML = `${escape(text.slice(0, shown))}<span class="jack-rest">${escape(text.slice(shown))}</span>`;
    box.classList.toggle('done', shown >= text.length);
  }

  function go(i) {
    step = i;
    if (step >= STORY.length) return finish();
    const s = current();
    onShot(s.shot, step === 0);
    shown = 0;
    typed = 0;
    wait = step === 0 ? 0.6 : CAMERA_PAUSE;
    box.classList.remove('visible');
    box.classList.toggle('speaker', !!s.who); // говорит Джек — с портретом и именем, иначе просто подпись
    nameNode.textContent = s.who || '';
    show();
  }

  function finish() {
    if (!active) return;
    active = false;
    box.classList.remove('visible');
    document.body.classList.remove('story');
    window.removeEventListener('pointerup', advance);
    window.removeEventListener('keydown', onKey, true);
    setTimeout(() => box.remove(), 400);
    onDone();
  }

  // Тап: пока камера едет или текст печатается — показать сразу; уже всё видно — следующий кадр
  function advance() {
    if (!active) return;
    const { text } = current();
    if (wait > 0 || shown < text.length) {
      wait = 0;
      shown = text.length;
      box.classList.add('visible');
      show();
    } else go(step + 1);
  }
  function onKey(e) {
    if (!active) return;
    if (e.code === 'Space' || e.code === 'Enter') advance();
    else if (e.code === 'Escape') finish();
    else return;
    e.preventDefault();
    e.stopPropagation(); // игра этих клавиш не слышит
  }
  box.querySelector('.story-skip').addEventListener('pointerup', (e) => {
    e.stopPropagation();
    finish();
  });

  return {
    get active() { return active; },
    // Сразу поставить первый кадр и спрятать интерфейс (пока мир догружается)
    prepare() {
      active = true;
      document.body.classList.add('story');
      onShot(STORY[0].shot, true);
    },
    // Мир готов — начать
    start() {
      active = true;
      document.body.classList.add('story');
      window.addEventListener('pointerup', advance);
      window.addEventListener('keydown', onKey, true);
      go(0);
    },
    update(dt) {
      if (!active || step < 0 || step >= STORY.length) return;
      const { text, who } = current();
      if (who) portrait.update(dt, { talking: wait <= 0 && shown < text.length, awake: true });
      if (wait > 0) {
        wait -= dt;
        if (wait <= 0) box.classList.add('visible');
        return;
      }
      if (shown >= text.length) return;
      typed += dt * JACK.typeSpeed;
      while (typed >= 1 && shown < text.length) {
        typed -= 1;
        if (text[shown++].trim() && who) onType();
      }
      show();
    },
  };
}
