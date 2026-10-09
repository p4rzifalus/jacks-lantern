// Подсказки без слов поверх мира: пузырь мысли над енотом со значком («уже полито», «корзинка полна»…)
// и всплывающие числа над местом действия («+12» с монеткой над корзиной, «+2» с семечком над грядкой).
// Это обычные элементы страницы, которые каждый кадр встают над нужной точкой сцены.
import * as THREE from 'three';
import { pixelIcon } from './icons.js';

const BUBBLE_SECONDS = 1.3; // сколько висит пузырь
const FLOAT_SECONDS = 1.4;  // сколько всплывает число
const FLOAT_RISE = 0.9;     // на сколько поднимается за это время (в метрах сцены)

export function createPopups(camera, canvas) {
  const layer = document.createElement('div');
  layer.className = 'popups';
  document.body.appendChild(layer);

  const v = new THREE.Vector3();
  function place(node, point) {
    const [x, y] = popups.screenOf(point);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

  const bubble = document.createElement('div');
  bubble.className = 'thought';
  layer.appendChild(bubble);
  let bubbleTime = 0;
  let bubbleAt = null; // () => точка над головой енота

  const floats = [];

  const popups = {
    // Где точка сцены на экране: [x, y] в пикселях страницы
    screenOf(point) {
      v.copy(point).project(camera);
      const rect = canvas.getBoundingClientRect();
      return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height];
    },

    // Пузырь мысли со значком icon над точкой at() (функция — енот может идти)
    think(icon, at) {
      bubble.innerHTML = pixelIcon(icon);
      bubble.classList.remove('visible');
      void bubble.offsetWidth; // перезапустить «выскакивание», если пузырь уже висел
      bubble.classList.add('visible');
      bubbleTime = BUBBLE_SECONDS;
      bubbleAt = at;
      place(bubble, at());
    },

    // Всплывающее число: text («+12»), значок рядом (icon — 'coin', 'seeds'…), над точкой at
    float(at, text, icon) {
      const node = document.createElement('div');
      node.className = 'float title';
      node.innerHTML = `<span>${text}</span>${icon ? pixelIcon(icon) : ''}`;
      layer.appendChild(node);
      floats.push({ node, at: at.clone(), t: 0 });
      place(node, at);
    },

    update(dt) {
      if (bubbleTime > 0) {
        bubbleTime -= dt;
        place(bubble, bubbleAt());
        if (bubbleTime <= 0) bubble.classList.remove('visible');
      }
      for (const f of [...floats]) {
        f.t += dt / FLOAT_SECONDS;
        if (f.t >= 1) {
          f.node.remove();
          floats.splice(floats.indexOf(f), 1);
          continue;
        }
        place(f.node, v.copy(f.at).setY(f.at.y + FLOAT_RISE * (1 - (1 - f.t) ** 2)));
        f.node.style.opacity = String(f.t < 0.7 ? 1 : (1 - f.t) / 0.3);
      }
    },
  };
  return popups;
}
