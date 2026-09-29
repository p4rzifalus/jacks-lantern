// Сохранение игры в браузере (localStorage). Без сервера.
// Тот же набор данных пишется и в файл (см. save-file.js), поэтому формат — в одном месте.
const KEY = 'ogorod2-save'; // своё имя: у первой версии на том же сайте — своё сохранение
const VERSION = 3; // меняется, когда меняется формат сохранения
const GAME = 'osennyaya-ferma-2'; // метка в файле, чтобы не спутать с чужим

// Полное сохранение: метка игры, версия формата, время сохранения и само состояние
export function packSave(state) {
  return { game: GAME, version: VERSION, savedAt: Date.now(), ...state };
}

export function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data) return null;
    return upgrade(data);
  } catch {
    return null; // сохранения нет или браузер не даёт читать — начинаем с нуля
  }
}

// Старые сохранения переводим в новый формат, шаг за шагом
function upgrade(data) {
  if (data.version === 1) {
    // Было: морковки в корзинке. Стало: монеты и счёт урожая.
    const count = data.basketCount || 0;
    data = { ...data, version: 2, coins: count * 2, harvested: { carrot: count } };
    delete data.basketCount;
  }
  if (data.version === 2) {
    // Было: урожай в лапах по одному, инструмент «руки». Стало: корзинка для сбора.
    data = { ...data, version: 3, tool: data.tool === 'hands' ? 'basket' : data.tool, carried: data.held ? [data.held] : [] };
    delete data.held;
  }
  return data.version === VERSION ? data : null;
}

// Текст из файла → сохранение, или null, если это не наш файл
export function readSave(text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || (data.game && data.game !== GAME)) return null;
    const upgraded = upgrade(data);
    return upgraded && Array.isArray(upgraded.cells) ? upgraded : null;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  storeSave(packSave(state));
}

// Записать готовое сохранение (например, из файла) — игра подхватит его при следующем запуске
export function storeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* браузер не даёт сохранять — играем без сохранения */ }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* нечего чистить */ }
}
