// Замеры скорости: счётчик на экране и эталонные сцены (веха 5, оптимизация).
//   адрес ?stats        — счётчик поверх обычной игры;
//   ?stats=day | night | rain — эталонная сцена: временный огород (сохранение не трогается), замер BENCH_SECONDS секунд и итог.
// В разработке то же самое — из панели G («Замеры»).

const BENCH_SECONDS = 20; // сколько длится замер сцены
const WARMUP_SECONDS = 1; // первые кадры после запуска не считаем (страница ещё догружается)
export const SCENES = { day: 'день', night: 'тяжёлая ночь', rain: 'дождь вечером' };

// Что просили в адресе: null — ничего, 'live' — только счётчик, 'day' / 'night' / 'rain' — сцена
export const BENCH = (() => {
  const value = new URLSearchParams(location.search).get('stats');
  if (value === null) return null;
  return SCENES[value] ? value : 'live';
})();
export const BENCH_SCENE = BENCH && BENCH !== 'live' ? BENCH : null;

// Счётчик: кадры в секунду, самый долгий кадр за последние 2 секунды, отрисовок и треугольников за кадр.
// begin() — в начале кадра, end(dt) — после отрисовки
export function createStats(renderer, qualityName) {
  renderer.info.autoReset = false; // считаем все проходы кадра вместе (сцена, тени, эффекты)
  const box = document.createElement('div');
  box.className = 'stats-box';
  document.body.appendChild(box);

  const recent = []; // [время, длина кадра в мс] за последние 2 секунды
  let shownAt = 0;
  let calls = 0;
  let tris = 0;
  const run = BENCH_SCENE ? { t: -WARMUP_SECONDS, frames: [], calls: [], done: false } : null;
  // Пока вкладка скрыта, браузер кадры не рисует: этот перерыв — не рывок игры, его не считаем
  let skipFrame = false;
  document.addEventListener('visibilitychange', () => { skipFrame = true; });

  function show(now) {
    const last = recent.filter(([t]) => now - t < 1000);
    const fps = last.length;
    const worst = Math.max(0, ...recent.map(([, ms]) => ms));
    const title = BENCH_SCENE ? `замер: ${SCENES[BENCH_SCENE]} · ${Math.max(0, Math.ceil(BENCH_SECONDS - run.t))} с` : `качество: ${qualityName}`;
    box.innerHTML = `<b>${fps}</b> кадров/с · худший ${worst.toFixed(0)} мс<br>${calls} отрисовок · ${(tris / 1000).toFixed(0)} тыс. треуг.<br><small>${title}</small>`;
  }

  // Итог замера сцены: окно с цифрами и кнопками «ещё раз» / «к игре»
  function finish() {
    run.done = true;
    const ms = run.frames.slice().sort((a, b) => a - b);
    const total = ms.reduce((a, b) => a + b, 0);
    const p99 = ms[Math.floor(ms.length * 0.99)] || 0;
    const avgCalls = run.calls.reduce((a, b) => a + b, 0) / Math.max(1, run.calls.length);
    const result = document.createElement('div');
    result.className = 'stats-result';
    result.innerHTML = `
      <div class="title">Замер: ${SCENES[BENCH_SCENE]}</div>
      <div class="stats-rows">
        <div><span>кадров в секунду</span><b>${((ms.length * 1000) / total).toFixed(0)}</b></div>
        <div><span>худший кадр</span><b>${ms.at(-1).toFixed(0)} мс</b></div>
        <div><span>1% худших кадров</span><b>${p99.toFixed(0)} мс</b></div>
        <div><span>отрисовок за кадр</span><b>${avgCalls.toFixed(0)}</b></div>
        <div><span>качество</span><b>${qualityName}</b></div>
        <div><span>экран</span><b>${renderer.domElement.width}×${renderer.domElement.height}</b></div>
      </div>
      <div class="stats-buttons"><button data-go="again">Ещё раз</button><button data-go="game">К игре</button></div>`;
    result.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go === 'again') location.reload();
      if (go === 'game') location.href = location.pathname;
    });
    document.body.appendChild(result);
  }

  return {
    begin() {
      renderer.info.reset();
    },
    end(dt) {
      const now = performance.now();
      if (skipFrame || document.hidden) {
        skipFrame = document.hidden;
        return;
      }
      calls = renderer.info.render.calls;
      tris = renderer.info.render.triangles;
      recent.push([now, dt * 1000]);
      while (recent.length && now - recent[0][0] > 2000) recent.shift();
      if (run && !run.done) {
        run.t += dt;
        if (run.t > 0) {
          run.frames.push(dt * 1000);
          run.calls.push(calls);
        }
        if (run.t >= BENCH_SECONDS) finish();
      }
      if (now - shownAt > 250) {
        shownAt = now;
        show(now);
      }
    },
  };
}
