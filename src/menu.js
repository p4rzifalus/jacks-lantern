// Стартовый экран и меню игры (кнопка в левом верхнем углу или Esc):
// продолжить / новая игра / сохранить в файл / загрузить из файла, звук и музыка.
import { canOverwrite, saveToFile, openSaveFile, lastFileInfo, hasOwnFile } from './save-file.js';
import { escapeHtml } from './text.js';
import { pixelIcon } from './icons.js';
import { showLayer } from './ui-motion.js';

// «28 сентября, 21:15»
function formatDate(time) {
  return new Date(time).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function el(tag, className, html = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  e.innerHTML = html;
  return e;
}

// engine — звук (включить/выключить, громкость)
// hasSave, savedAt — есть ли огород в браузере и когда он сохранён
// snapshot() — сохранение для записи в файл
// onNewGame() — начать заново; onLoad(data) — заменить огород загруженным
// onOpenChange(open) — меню открылось/закрылось (пока открыто, герой стоит)
export function createMenu({ engine, hasSave, savedAt, snapshot, onNewGame, onLoad, onOpenChange }) {
  const backdrop = el('div', 'menu-backdrop');
  const card = el('div', 'menu');
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  let ready = false; // загрузился ли мир (до этого кнопки стартового экрана неактивны)
  let screen = null; // 'start' | 'menu' | 'discovery' | null
  let busy = false;  // идёт работа с файлом — повторные нажатия не нужны

  const setScreen = (name) => {
    const wasOpen = !!screen;
    screen = name;
    showLayer(backdrop, !!name); // окно раскрывается и сворачивается (ui.css)
    document.body.classList.toggle('intro', name === 'start');
    if (wasOpen !== !!name) onOpenChange(!!name);
  };

  // ---------- Строки состояния ----------
  let statusText = '';
  const status = (text) => {
    statusText = text;
    const box = card.querySelector('.menu-status');
    if (box) box.textContent = text;
  };
  const fileLine = () => {
    const info = lastFileInfo();
    return info ? `Последний файл: ${escapeHtml(info.name)} · ${formatDate(info.savedAt)}` : '';
  };

  // ---------- Окно-вопрос ----------
  // buttons: [{ label, value, primary }] → Promise с value нажатой кнопки
  function ask(text, buttons) {
    const back = screen;
    return new Promise((resolve) => {
      card.innerHTML = `<div class="menu-text">${text}</div><div class="menu-buttons"></div>`;
      const row = card.querySelector('.menu-buttons');
      for (const b of buttons) {
        const button = el('button', b.primary ? 'primary' : '', b.label);
        button.addEventListener('click', () => {
          render(back);
          resolve(b.value);
        });
        row.appendChild(button);
      }
    });
  }

  // ---------- Действия ----------
  async function saveFile(newFile = false) {
    if (busy) return false;
    busy = true;
    try {
      const name = await saveToFile(snapshot(), { newFile });
      if (name) status(canOverwrite ? `Сохранено в «${name}»` : `Скачан файл «${name}»`);
      render(screen);
      return !!name;
    } catch {
      status('Не получилось сохранить файл');
      return false;
    } finally {
      busy = false;
    }
  }

  async function loadFile() {
    if (busy) return;
    busy = true;
    let result;
    try {
      result = await openSaveFile();
    } catch {
      result = { error: 'Не получилось открыть файл' };
    }
    busy = false;
    if (!result) return;
    if (result.error) {
      status(result.error);
      return;
    }
    const replacing = screen === 'menu' || hasSave;
    if (replacing) {
      const answer = await ask(
        `Загрузить огород из файла «${escapeHtml(result.name)}» (сохранён ${formatDate(result.data.savedAt)})?<br>Нынешний огород заменится.`,
        [{ label: 'Загрузить', value: true, primary: true }, { label: 'Отмена', value: false }],
      );
      if (!answer) return;
    }
    onLoad(result.data);
  }

  async function newGame() {
    if (screen === 'start' && !hasSave) {
      close(); // огорода ещё нет — просто начинаем
      return;
    }
    const answer = await ask(
      'Начать новую игру?<br>Нынешний огород пропадёт. Чтобы вернуться к нему потом, сначала сохраните его в файл.',
      [
        { label: 'Сохранить в файл и начать', value: 'save', primary: true },
        { label: 'Начать без сохранения', value: 'new' },
        { label: 'Отмена', value: null },
      ],
    );
    if (answer === 'save' && !(await saveFile())) return; // не сохранилось — не стираем
    if (answer) onNewGame();
  }

  // ---------- Экраны ----------
  function soundRow(name, label) {
    const on = engine.isOn(name);
    const level = Math.round(engine.level(name) * 100);
    return `<div class="menu-sound">
      <button class="toggle ${on ? 'on' : ''}" data-toggle="${name}" aria-pressed="${on}">${label}: ${on ? 'вкл' : 'выкл'}</button>
      <input type="range" min="0" max="100" step="5" value="${level}" data-level="${name}" aria-label="Громкость: ${label.toLowerCase()}" ${on ? '' : 'class="dim"'} />
    </div>`;
  }

  function render(name, data) {
    if (name === 'discovery') {
      // выведен новый гибрид: большая картинка, имя и от кого — без слов; закрывается тапом в любом месте
      card.innerHTML = `
        <div class="menu-discovery" data-act="close"><img src="${data.image}" alt=""></div>
        <div class="menu-title title" data-act="close">${escapeHtml(data.name)}</div>
        <div class="menu-parents" data-act="close"><img src="${data.parents[0]}" alt="">+<img src="${data.parents[1]}" alt=""></div>`;
    } else if (name === 'start') {
      const wait = ready ? '' : 'disabled'; // пока мир грузится, кнопки ждут (полоска загрузки — сверху)
      card.innerHTML = `
        <div class="menu-title title">Jack’s Lantern</div>
        <div class="menu-subtitle">огород на летающем острове</div>
        <div class="menu-buttons column">
          ${hasSave ? `<button class="primary" data-act="continue" ${wait}>Продолжить<small>огород от ${formatDate(savedAt)}</small></button>` : ''}
          <button class="${hasSave ? '' : 'primary'}" data-act="new" ${wait}>Новая игра</button>
          <button data-act="load" ${wait}>Загрузить из файла</button>
        </div>
        <div class="menu-status">${escapeHtml(statusText)}</div>`;
    } else if (name === 'menu') {
      card.innerHTML = `
        <div class="menu-head"><span class="title flourished">Меню</span><button class="menu-close" data-act="close" aria-label="Закрыть">${pixelIcon('close')}</button></div>
        <div class="menu-section">
          ${soundRow('effects', 'Звуки')}
          ${soundRow('music', 'Музыка')}
        </div>
        <div class="menu-section menu-buttons column">
          <button data-act="save">Сохранить в файл</button>
          <button class="link" data-act="save-new" hidden>сохранить в новый файл</button>
          <button data-act="load">Загрузить из файла</button>
          <button data-act="new">Новая игра</button>
        </div>
        <div class="menu-file">${fileLine()}</div>
        <div class="menu-status">${escapeHtml(statusText)}</div>
        <div class="menu-buttons"><button class="primary" data-act="close">Продолжить</button></div>`;
      if (canOverwrite) hasOwnFile().then((own) => { const b = card.querySelector('[data-act="save-new"]'); if (b) b.hidden = !own; });
    }
    setScreen(name);
  }

  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const toggle = e.target.closest('[data-toggle]')?.dataset.toggle;
    if (toggle) engine.toggle(toggle);
    if (act === 'continue' || act === 'close') close();
    if (act === 'new') newGame();
    if (act === 'load') loadFile();
    if (act === 'save') saveFile();
    if (act === 'save-new') saveFile(true);
  });
  card.addEventListener('input', (e) => {
    const name = e.target.dataset?.level;
    if (name) engine.setLevel(name, Number(e.target.value) / 100);
  });
  // клик мимо окна закрывает меню (но не стартовый экран)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && (screen === 'menu' || screen === 'discovery')) close();
  });
  // звук переключили клавишами N / M — обновить кнопки
  engine.onChange(() => {
    if (screen !== 'menu') return;
    for (const b of card.querySelectorAll('[data-toggle]')) {
      const on = engine.isOn(b.dataset.toggle);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = `${b.dataset.toggle === 'music' ? 'Музыка' : 'Звуки'}: ${on ? 'вкл' : 'выкл'}`;
      const slider = card.querySelector(`[data-level="${b.dataset.toggle}"]`);
      slider.classList.toggle('dim', !on);
    }
  });

  function close() {
    status('');
    setScreen(null);
  }

  return {
    // Мир загрузился и готов: кнопки стартового экрана оживают
    setReady() {
      ready = true;
      if (screen === 'start') render('start');
    },
    get isOpen() { return !!screen; },
    get isStart() { return screen === 'start'; },
    showStart: () => render('start'),
    // Окно «новое растение»: { name, image (адрес картинки), parents: [картинка, картинка] }
    showDiscovery(data) {
      if (!screen) render('discovery', data);
    },
    open: () => render('menu'),
    close() {
      if (screen === 'menu' || screen === 'discovery') close(); // стартовый экран закрывается только кнопками
    },
    toggle() {
      if (screen === 'menu') close();
      else if (!screen) render('menu');
    },
  };
}
