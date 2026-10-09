// Движение интерфейса (этап 14г): окно или ряд появляется с анимацией, а прячется — сначала доиграв исчезание.
// Сами движения — в ui.css (классы .visible и .closing).

const CLOSE_MS = 140; // столько длится исчезание в ui.css (--close-time)

// Показать или спрятать элемент: on — нужен ли он сейчас. Можно звать хоть каждый кадр — действует только на смену
export function showLayer(el, on) {
  if (on) {
    clearTimeout(el._closing);
    el.classList.remove('closing');
    el.classList.add('visible');
  } else if (el.classList.contains('visible') && !el.classList.contains('closing')) {
    el.classList.add('closing');
    el._closing = setTimeout(() => el.classList.remove('visible', 'closing'), CLOSE_MS);
  }
}

// Счётчик, который «прокручивается» до нового числа: el — где писать число
export function rollingNumber(el, onChange) {
  let shown = null;
  let target = null;
  let frame = 0;
  return (value) => {
    if (value === target) return;
    const from = shown ?? value;
    target = value;
    cancelAnimationFrame(frame);
    if (from === value || document.hidden) { // вкладка скрыта — крутить некому, просто ставим число
      shown = value;
      el.textContent = value;
      return;
    }
    onChange?.(value > from ? 'up' : 'down');
    const start = performance.now();
    const ms = Math.min(700, 250 + Math.abs(value - from) * 25); // большие суммы крутятся чуть дольше
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const k = 1 - (1 - t) ** 3; // быстро в начале, мягко в конце
      shown = Math.round(from + (value - from) * k);
      el.textContent = shown;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
}
