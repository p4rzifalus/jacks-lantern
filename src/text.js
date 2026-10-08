// Русские слова рядом с числом: plural(5, ['морковку', 'морковки', 'морковок']) → «5 морковок»
export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// «1 мин», «1,5 мин», «45 с»
export function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)} с`;
  return `${String(Math.round((seconds / 60) * 10) / 10).replace('.', ',')} мин`;
}

// Текст для вставки в HTML (например, имя файла): «<» и прочее — как обычные буквы
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
