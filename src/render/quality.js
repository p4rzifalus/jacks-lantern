// Уровень качества картинки: на телефоне — «среднее» (облегчённое для телефона), на компьютере — «высокое».
// Сами значения уровней — в config.js → QUALITY.
import { QUALITY } from '../config.js';

const STORAGE_KEY = 'ogorod2-quality';

// Телефон начинает со «среднего», но чётче (экраны у телефонов плотные) и с лёгкими картинками (512, меньше качать);
// сглаживание краёв не нужно — его даёт сама чёткость. Если телефону тяжело, сторож кадров (pipeline.js) облегчит сам
const PHONE = { maxDpr: 1.5, msaa: 0, textureSize: 512 };

export function detectQuality() {
  const phone = window.matchMedia('(pointer: coarse)').matches;
  let name = phone ? 'medium' : 'high';
  try {
    // выбранное вручную в панели G (только при разработке)
    const saved = import.meta.env.DEV ? localStorage.getItem(STORAGE_KEY) : null;
    if (QUALITY[saved]) name = saved;
  } catch { /* браузер не даёт читать — берём по устройству */ }
  if (phone && name === 'medium') return { name: 'medium (телефон)', ...QUALITY.medium, ...PHONE };
  return { name, ...QUALITY[name] };
}

export function rememberQuality(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch { /* не страшно */ }
}
