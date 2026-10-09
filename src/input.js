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
  // Два пальца — щипок: свёл — отдалить, развёл — приблизить; заодно двигает сцену вслед за пальцами
  const DRAG_THRESHOLD = 8; // на сколько точек сдвинуть палец, чтобы это считалось драгом
  let press = null;
  const touches = new Map(); // пальцы на экране: id → { x, y }
  let pinch = null;          // { dist, x, y } — идёт щипок: расстояние между пальцами и точка между ними
  function pinchNow() {
    const [a, b] = [...touches.values()];
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // Safari: щипок — игре, а не странице

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { // второй палец — щипок; первый палец уже не тап
      pinch = pinchNow();
      if (press) press.dragging = true;
      input.hoverCell = null;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (press) return; // третий палец не трогаем
    press = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, dragging: false };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (touches.size < 2) return;
      const now = pinchNow();
      handlers.onPan?.(now.x - pinch.x, now.y - pinch.y);
      handlers.onPinch?.(now.dist / pinch.dist, now.x, now.y);
      pinch = now;
      return;
    }
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

  // палец убрали: щипок кончился; оставшийся палец продолжает двигать сцену с того места, где он сейчас
  function liftFinger(id) {
    touches.delete(id);
    if (pinch && touches.size < 2) {
      pinch = null;
      const rest = press && touches.get(press.id);
      if (rest) {
        press.lastX = rest.x;
        press.lastY = rest.y;
      }
    }
  }

  canvas.addEventListener('pointerup', (e) => {
    liftFinger(e.pointerId);
    if (!press || e.pointerId !== press.id) return;
    const wasDrag = press.dragging;
    press = null;
    if (wasDrag) return;
    const cell = cellAt(e);
    input.hoverCell = e.pointerType === 'mouse' ? cell : null; // пальцем не «наводят» — рамка не залипает
    if (cell) handlers.onCellClick?.(cell);
  });

  canvas.addEventListener('pointercancel', (e) => {
    liftFinger(e.pointerId);
    if (press && e.pointerId === press.id) press = null;
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !press) input.hoverCell = null;
  });

  return input;
}
