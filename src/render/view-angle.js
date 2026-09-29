// Угол камеры вокруг острова (0 — смотрим вдоль оси z). Спрайты и частицы разворачиваются к камере по нему.
export const viewAngle = { yaw: Math.PI / 4 }; // по умолчанию — по диагонали, как в изометрии

const sprites = []; // все спрайты (почти все создаются при запуске; духи приходят и уходят)

export function registerSprite(object) {
  object.rotation.y = viewAngle.yaw;
  sprites.push(object);
}

// Спрайт убрали со сцены насовсем (например, дух ушёл в туман)
export function unregisterSprite(object) {
  const i = sprites.indexOf(object);
  if (i >= 0) sprites.splice(i, 1);
}

export function setViewYaw(yaw) {
  viewAngle.yaw = yaw;
  for (const o of sprites) o.rotation.y = yaw;
}
