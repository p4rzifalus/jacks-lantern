// Подсказки интерфейса (этап 14д): на компьютере — при наведении мыши, на телефоне — долгим нажатием
// (отпустил — исчезла, а кнопка при этом не сработала). Текст — из title любого элемента;
// вместо системной подсказки браузера — бумажная плашка (ui.css → .tip).

const HOVER_MS = 450; // сколько держать мышь, прежде чем появится подсказка
const HOLD_MS = 450;  // сколько держать палец
const SLOP = 10;      // палец сдвинулся больше — это не нажатие, а движение

export function createTooltips() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.appendChild(tip);

  let timer = 0;
  let shownFor = null;
  let swallowClick = false; // после долгого нажатия «щелчок» отпускания не считается
  let start = null;

  // title → data-tip: системная подсказка больше не всплывает, текст остаётся у элемента
  const textOf = (el) => {
    if (el.title) {
      el.dataset.tip = el.title;
      el.removeAttribute('title');
    }
    return el.dataset.tip;
  };
  const targetOf = (e) => e.target.closest?.('[title], [data-tip]');

  function show(el) {
    const text = el.isConnected && textOf(el); // интерфейс мог перерисоваться, пока ждали
    if (!text) return false;
    tip.textContent = text;
    tip.classList.add('visible');
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8);
    let y = r.top - tip.offsetHeight - 10;
    if (y < 8) y = r.bottom + 10; // сверху нет места — под элементом
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
    shownFor = el;
    return true;
  }
  function hide() {
    clearTimeout(timer);
    tip.classList.remove('visible');
    shownFor = null;
  }

  // Мышь: навёл и подержал
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = targetOf(e);
    if (!el || el === shownFor) return;
    hide();
    textOf(el);
    timer = setTimeout(() => show(el), HOVER_MS);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = targetOf(e);
    if (el && !el.contains(e.relatedTarget)) hide();
  });

  // Палец: нажал и держит
  document.addEventListener('pointerdown', (e) => {
    hide();
    swallowClick = false;
    if (e.pointerType === 'mouse') return;
    const el = targetOf(e);
    if (!el) return;
    textOf(el);
    start = [e.clientX, e.clientY];
    timer = setTimeout(() => { swallowClick = show(el); }, HOLD_MS);
  });
  document.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > SLOP) {
      start = null;
      if (!shownFor) clearTimeout(timer);
    }
  });
  const release = () => {
    start = null;
    hide();
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  // долгое нажатие на телефоне не должно открывать системное меню («скопировать», «сохранить картинку»)
  document.addEventListener('contextmenu', (e) => {
    if (targetOf(e)) e.preventDefault();
  });
}
