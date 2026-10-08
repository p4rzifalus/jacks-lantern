// Управление: клавиатура (ходьба, действие, инструменты) и мышь/тап (клик по клетке).
import * as THREE from 'three';
import { worldToCell, isInGarden } from './grid.js';

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

// pickables — объекты, по которым тоже можно кликнуть: [{ object, cell }]
export function createInput(canvas, camera, handlers = {}, pickables = []) {
  const pressed = new Set();

  // «Вверх» на клавиатуре = вверх по экрану. Переводим направления экрана в направления на земле
  // (считаем каждый раз заново: мир можно повернуть).
  const screenUp = new THREE.Vector3();
  const screenRight = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  // Отпускание клавиши иногда теряется: на Mac, пока зажат Cmd, браузер не сообщает об отпускании других клавиш;
  // переключились в другое окно, открылось контекстное меню. Тогда герой бежал бы сам — сбрасываем всё, что зажато
  const releaseAll = () => pressed.clear();
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return releaseAll(); // сочетания с Cmd/Ctrl — не ходьба
    if (!input.enabled) return; // открыто меню
    if (MOVE_KEYS[e.code]) {
      pressed.add(MOVE_KEYS[e.code]);
      e.preventDefault();
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) handlers.onAction?.();
    } else if (/^Digit[1-4]$/.test(e.code)) {
      handlers.onTool?.(Number(e.code.slice(5)));
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Meta' || e.key === 'Control') releaseAll();
    else pressed.delete(MOVE_KEYS[e.code]);
  });
  window.addEventListener('blur', releaseAll);
  window.addEventListener('contextmenu', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // Какая клетка огорода (или кликабельный объект) под указателем, иначе null
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function cellAt(e) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    for (const p of pickables) {
      if (raycaster.intersectObject(p.object, true).length) return p.cell;
    }
    const hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!hit) return null;
    const cell = worldToCell(hit);
    return isInGarden(cell) ? cell : null;
  }

  const input = {
    hoverCell: null,
    enabled: true, // false — управление выключено (открыто меню)

    // Направление ходьбы с клавиатуры (нулевой вектор, если ничего не нажато)
    getMoveDir() {
      camera.getWorldDirection(screenUp);
      screenUp.setY(0).normalize();
      screenRight.crossVectors(screenUp, worldUp);
      const dir = new THREE.Vector3();
      if (!input.enabled) {
        releaseAll(); // открыто меню — после него герой не должен уйти сам
        return dir;
      }
      if (pressed.has('up')) dir.add(screenUp);
      if (pressed.has('down')) dir.sub(screenUp);
      if (pressed.has('right')) dir.add(screenRight);
      if (pressed.has('left')) dir.sub(screenRight);
      return dir;
    },
  };

  // Нажал и повёл — двигаем сцену. Нажал и отпустил на месте — это клик/тап по клетке.
  const DRAG_THRESHOLD = 8; // на сколько точек сдвинуть палец, чтобы это считалось драгом
  let press = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (press) return; // второй палец не трогаем
    press = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, dragging: false };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (press && e.pointerId === press.id) {
      if (!press.dragging && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > DRAG_THRESHOLD) {
        press.dragging = true;
      }
      if (press.dragging) {
        handlers.onPan?.(e.clientX - press.lastX, e.clientY - press.lastY);
        press.lastX = e.clientX;
        press.lastY = e.clientY;
        input.hoverCell = null;
        return;
      }
    }
    input.hoverCell = cellAt(e);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const wasDrag = press.dragging;
    press = null;
    if (wasDrag) return;
    const cell = cellAt(e);
    input.hoverCell = e.pointerType === 'mouse' ? cell : null; // пальцем не «наводят» — рамка не залипает
    if (cell) handlers.onCellClick?.(cell);
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (press && e.pointerId === press.id) press = null;
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !press) input.hoverCell = null;
  });

  return input;
}
