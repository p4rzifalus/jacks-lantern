// Сохранение в файл и загрузка из файла (JSON), как в обычных играх.
//  • Chrome и Edge на компьютере: первый раз спрашиваем, куда сохранить, дальше молча перезаписываем тот же файл.
//    Файл запоминается и после перезагрузки (браузер тогда один раз спросит разрешение его изменить).
//  • Телефон и Safari: каждый раз скачивается новый файл с датой в имени.
import { readSave } from './save.js';

const INFO_KEY = 'ogorod2-file'; // имя последнего файла и время сохранения — для строки в меню
const FILE_TYPES = [{ description: 'Сохранение «Осенней фермы»', accept: { 'application/json': ['.json'] } }];

// Умеет ли браузер перезаписывать файл
export const canOverwrite = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';

// ---------- Запоминаем выбранный файл (только Chrome/Edge) ----------
// Сам «доступ к файлу» можно хранить только в IndexedDB — маленькая база браузера
function withStore(mode, action) {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open('ogorod2', 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      try {
        const tx = request.result.transaction('files', mode);
        const r = action(tx.objectStore('files'));
        tx.oncomplete = () => resolve(r?.result ?? null);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null); // не получилось — просто не запомним файл
      }
    };
  });
}
let fileHandle = null;
const handleReady = canOverwrite ? withStore('readonly', (s) => s.get('save')).then((h) => { fileHandle = h; }) : Promise.resolve();
function rememberHandle(handle) {
  fileHandle = handle;
  withStore('readwrite', (s) => s.put(handle, 'save'));
}

// ---------- Строка «последний файл» ----------
export function lastFileInfo() {
  try {
    return JSON.parse(localStorage.getItem(INFO_KEY));
  } catch {
    return null;
  }
}
function rememberInfo(name, savedAt) {
  try {
    localStorage.setItem(INFO_KEY, JSON.stringify({ name, savedAt }));
  } catch { /* не страшно */ }
}

// Есть ли файл, который перезапишется без вопросов
export async function hasOwnFile() {
  await handleReady;
  return !!fileHandle;
}

// Имя для нового файла: ferma2-2026-09-28-21-15.json
function fileName(time) {
  const d = new Date(time);
  const two = (n) => String(n).padStart(2, '0');
  return `ferma2-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}-${two(d.getMinutes())}.json`;
}

// Сохранить. data — готовое сохранение (packSave). newFile — спросить новый файл, даже если свой уже есть.
// Возвращает имя файла или null, если игрок передумал.
export async function saveToFile(data, { newFile = false } = {}) {
  const text = JSON.stringify(data, null, 2);
  if (!canOverwrite) {
    const name = fileName(data.savedAt);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    rememberInfo(name, data.savedAt);
    return name;
  }

  await handleReady;
  let handle = newFile ? null : fileHandle;
  try {
    if (handle && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') handle = null;
    }
    if (!handle) {
      handle = await window.showSaveFilePicker({ suggestedName: fileName(data.savedAt), types: FILE_TYPES });
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  } catch (e) {
    if (e.name === 'AbortError') return null; // закрыл окно выбора — ничего не делаем
    throw e;
  }
  rememberHandle(handle);
  rememberInfo(handle.name, data.savedAt);
  return handle.name;
}

// Выбрать файл и прочитать сохранение. Возвращает { data, name }, null — передумал,
// { error } — файл не наш или испорчен.
export async function openSaveFile() {
  let file;
  let handle = null;
  if (canOverwrite) {
    try {
      [handle] = await window.showOpenFilePicker({ types: FILE_TYPES });
      file = await handle.getFile();
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  } else {
    file = await pickWithInput();
    if (!file) return null;
  }
  const data = readSave(await file.text());
  if (!data) return { error: 'Это не файл сохранения «Осенней фермы»' };
  if (handle) rememberHandle(handle); // дальше сохраняем в этот же файл
  rememberInfo(file.name, data.savedAt);
  return { data, name: file.name };
}

// Обычный выбор файла (телефон, Safari)
// Старый Safari не сообщает, что окно выбора закрыли без файла, — тогда ждём возврата фокуса на страницу
function pickWithInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    const done = (file) => {
      window.removeEventListener('focus', onFocus);
      resolve(file);
    };
    const onFocus = () => setTimeout(() => done(input.files[0] || null), 1000); // «change» может прийти чуть позже фокуса
    input.addEventListener('change', () => done(input.files[0] || null));
    input.addEventListener('cancel', () => done(null));
    window.addEventListener('focus', onFocus);
    input.click();
  });
}
