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
// economy() — что сторож кадров сейчас облегчил: { level, steps, off: ['ao', 'rays', 'dpr:1.25', …] }
export function createStats(renderer, qualityName, economy = () => null) {
  renderer.info.autoReset = false; // считаем все проходы кадра вместе (сцена, тени, эффекты)
  const box = document.createElement('div');
  box.className = 'stats-box';
  document.body.appendChild(box);

  // «ничего» или «тени углов, лучи, чёткость 1,25»
  const NAMES = { ao: 'затенение углов', rays: 'лучи', tilt: 'размытие краёв' };
  function lightened() {
    const e = economy();
    if (!e || !e.level) return 'ничего';
    return e.off.map((st) => NAMES[st] || `чёткость ${st.slice(4).replace('.', ',')}`).join(', ');
  }

  // Журнал рывков (этап 14е): каждый кадр дольше JANK_MS — с подписями, что в нём происходило.
  // Подписи: «шейдер» — видеокарта готовила новый вид графики, «текстура» — загружала картинку,
  // «память» — браузер убирал мусор, «тени N» — сколько теней пересчитано, остальное — mark() из main.js.
  // Последние рывки видны в счётчике, весь журнал — в консоли: window.jank
  const JANK_MS = 25;
  const jank = [];
  window.jank = jank;
  let tags = [];
  let prevTags = []; // рывок часто виден кадром позже: видеокарта доделывает работу прошлого кадра
  let beginAt = 0;
  let programs = renderer.info.programs?.length ?? 0;
  let textures = renderer.info.memory.textures;
  let heap = performance.memory?.usedJSHeapSize ?? 0;

  const recent = []; // [время, длина кадра в мс] за последние 2 секунды
  let shownAt = 0;
  let calls = 0;
  let tris = 0;
  const run = BENCH_SCENE ? { t: -WARMUP_SECONDS, frames: [], calls: [], done: false, started: false } : null;
  // Пока вкладка скрыта, браузер кадры не рисует: этот перерыв — не рывок игры, его не считаем
  let skipFrame = false;
  document.addEventListener('visibilitychange', () => { skipFrame = true; });

  function show(now) {
    const last = recent.filter(([t]) => now - t < 1000);
    const fps = last.length;
    const worst = Math.max(0, ...recent.map(([, ms]) => ms));
    const title = BENCH_SCENE ? `замер: ${SCENES[BENCH_SCENE]} · ${Math.max(0, Math.ceil(BENCH_SECONDS - run.t))} с` : `качество: ${qualityName}`;
    const lastJank = jank.slice(-3).reverse().map((j) => `${j.gap} мс (работа ${j.cpu}) ${j.tags.join(', ')}${j.before.length ? ` ← ${j.before.join(', ')}` : ''}`).join('<br>');
    box.innerHTML = `<b>${fps}</b> кадров/с · худший ${worst.toFixed(0)} мс<br>${calls} отрисовок · ${(tris / 1000).toFixed(0)} тыс. треуг.<br><small>${title} · ${lightened()}</small>`
      + (jank.length ? `<br><small>рывков: ${jank.length}<br>${lastJank}</small>` : '');
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
        <div><span>сторож облегчил</span><b>${lightened()}</b></div>
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
    // Мир загрузился — сцена построена, можно мерить
    start() {
      if (run) run.started = true;
    },
    begin() {
      renderer.info.reset();
      beginAt = performance.now();
      tags = [];
    },
    // Подписать текущий кадр для журнала рывков (например, 'сохранение')
    mark(tag) {
      tags.push(tag);
    },
    // Перед отрисовкой: сколько теней будет пересчитано в этом кадре
    shadows(scene) {
      let n = 0;
      if (renderer.shadowMap.needsUpdate) scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow.needsUpdate) n++; });
      if (n) tags.push(`тени ${n}`);
    },
    end(dt) {
      const now = performance.now();
      if (skipFrame || document.hidden) {
        skipFrame = document.hidden;
        return;
      }
      const cpu = now - beginAt;
      const nowPrograms = renderer.info.programs?.length ?? 0;
      const nowTextures = renderer.info.memory.textures;
      const nowHeap = performance.memory?.usedJSHeapSize ?? 0;
      if (nowPrograms !== programs) tags.push('шейдер');
      if (nowTextures > textures) tags.push('текстура');
      if (nowHeap < heap - 1e6) tags.push('память');
      programs = nowPrograms;
      textures = nowTextures;
      heap = nowHeap;
      if (dt * 1000 > JANK_MS) {
        jank.push({ at: Math.round(now / 100) / 10, gap: Math.round(dt * 1000), cpu: Math.round(cpu), tags, before: prevTags });
        if (jank.length > 200) jank.shift();
      }
      prevTags = tags;
      calls = renderer.info.render.calls;
      tris = renderer.info.render.triangles;
      recent.push([now, dt * 1000]);
      while (recent.length && now - recent[0][0] > 2000) recent.shift();
      if (run && run.started && !run.done) {
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
