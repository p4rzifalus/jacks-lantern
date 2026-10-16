// Геймпад: стик и крестовина — ходьба, кнопки — те же действия, что и на клавиатуре.
// Браузер не сообщает о нажатиях кнопок геймпада событиями — опрашиваем его на каждом кадре.
import { GAMEPAD } from './config.js';

// Номера кнопок в «стандартной» раскладке браузера (Xbox, PlayStation и большинство известных геймпадов)
const BUTTONS = {
  0: 'action',    // A (✕) — действие на клетке
  1: 'back',      // B (○) — закрыть магазин или гербарий
  2: 'herbarium', // X (□) — гербарий
  3: 'shop',      // Y (△) — магазин
  4: 'prevTool',  // LB — предыдущий инструмент
  5: 'nextTool',  // RB — следующий инструмент
  9: 'menu',      // Start — меню
  11: 'closeUp',  // нажатие правого стика — крупный план
};
// Простые геймпады без «стандартной» раскладки (режим D-input, «как у Android») — свои номера кнопок
const GENERIC_BUTTONS = {
  0: 'action',    // A
  1: 'back',      // B
  3: 'herbarium', // X
  4: 'shop',      // Y
  6: 'prevTool',  // LB
  7: 'nextTool',  // RB
  9: 'closeUp',   // Start — крупный план (так попросили; меню — на Select)
  10: 'menu',     // Select — меню
  11: 'closeUp',  // нажатие правого стика — крупный план
};
const DPAD = { 12: [0, 1], 13: [0, -1], 14: [-1, 0], 15: [1, 0] }; // крестовина: вверх, вниз, влево, вправо

// У простых геймпадов без «стандартной» раскладки крестовина — одна ось-«шляпка»:
// от −1 (вверх) по часовой стрелке шагами по 2/7. Значение в покое у разных геймпадов своё
// (обычно больше 1, но бывает и внутри −1…1) — поэтому запоминаем его и откликаемся только на изменение
const HAT_DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
function hatDir(v, rest) {
  if (v === undefined || Math.abs(v) > 1.05 || Math.abs(v - rest) < 0.05) return null;
  return HAT_DIRS[Math.round((v + 1) / (2 / 7)) % 8];
}

// onPress(name) — вызывается один раз в момент нажатия кнопки (и отклонения стика / крестовины: up, down, left, right)
export function createGamepad(onPress) {
  const held = new Set(); // какие кнопки были зажаты на прошлом кадре: «индекс геймпада:кнопка»
  const hatRest = new Map(); // значение оси-«шляпки» в покое — по геймпадам (первое, что прочитали)
  let lastWay = null; // куда был отклонён стик / крестовина на прошлом кадре
  const firedAt = new Map(); // действие → когда последний раз сработало с кнопки (мс)
  const turned = new Set(); // у каких геймпадов правый стик уже повернул мир и ещё не вернулся в середину
  window.addEventListener('gamepaddisconnected', (e) => hatRest.delete(e.gamepad.index));

  // Возвращает направление ходьбы на экране: x — вправо, y — вверх (нулевое, если ничего не нажато)
  function poll() {
    const dir = { x: 0, y: 0 };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad?.connected) continue;

      const names = pad.mapping === 'standard' ? BUTTONS : GENERIC_BUTTONS;
      pad.buttons.forEach((b, i) => {
        const key = `${pad.index}:${i}`;
        if (!b.pressed) return held.delete(key);
        if (held.has(key)) return; // зажатая кнопка срабатывает один раз
        held.add(key);
        const name = names[i];
        if (!name) return;
        const now = performance.now();
        if (now - (firedAt.get(name) ?? -Infinity) < GAMEPAD.repeatGap * 1000) return; // двойное нажатие — пропускаем
        firedAt.set(name, now);
        onPress(name);
      });

      // Правый стик влево / вправо — повернуть мир на шаг (ещё раз — сначала вернуть стик в середину)
      const rx = pad.axes[2] ?? 0;
      const turn = rx > 0.6 ? 1 : rx < -0.6 ? -1 : 0;
      if (turn && !turned.has(pad.index)) {
        turned.add(pad.index);
        onPress(turn > 0 ? 'rotateRight' : 'rotateLeft');
      } else if (Math.abs(rx) < 0.3) turned.delete(pad.index);

      // Левый стик (вверх у стика — отрицательные значения)
      const [sx = 0, sy = 0] = pad.axes;
      if (Math.hypot(sx, sy) > GAMEPAD.deadzone) {
        dir.x += sx;
        dir.y -= sy;
      }
      // Крестовина: кнопками или осью-«шляпкой» (обычно последняя ось)
      if (pad.mapping === 'standard') {
        for (const [i, [dx, dy]] of Object.entries(DPAD)) {
          if (pad.buttons[i]?.pressed) { dir.x += dx; dir.y += dy; }
        }
      } else if (pad.axes[9] !== undefined) {
        if (!hatRest.has(pad.index)) hatRest.set(pad.index, pad.axes[9]);
        const hat = hatDir(pad.axes[9], hatRest.get(pad.index));
        if (hat) { dir.x += hat[0]; dir.y += hat[1]; }
      }
    }

    // Для меню: направление «щелчком» — один раз, когда стик или крестовину отклонили (up / down / left / right)
    const way = Math.max(Math.abs(dir.x), Math.abs(dir.y)) < 0.5 ? null
      : Math.abs(dir.y) >= Math.abs(dir.x) ? (dir.y > 0 ? 'up' : 'down') : (dir.x > 0 ? 'right' : 'left');
    if (way && way !== lastWay) onPress(way);
    lastWay = way;
    return dir;
  }

  return { poll };
}
