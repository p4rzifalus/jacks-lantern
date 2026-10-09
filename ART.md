# ТЗ на графику

## Что какое: правило разделения
**Мир — реалистичный, всё живое и мелкое — пиксельное.**

| Реалистичное (фото-текстуры, PBR) | Пиксельное (пиксель-арт, спрайты) |
|---|---|
| Поверхности 3D-мира: трава острова, обрывы, земля грядок, камень, доски стен, черепица, кора, листва кроны, дерево (рамы, бочка, поленья), плетёнка корзинки | Герой — енот и крот (все анимации), растения по стадиям, урожай, инструменты в лапах, пучки травы и цветы, падающие листья и искры, иконки интерфейса |

Реалистичные текстуры рисуются гладко (без пикселей) и получают рельеф и блики.
Пиксельные спрайты рисуются чётко, целым масштабом (каждый пиксель рисунка = ровный квадрат на экране).
Общего пиксельного фильтра на всю картинку больше нет.

## Как сдавать файлы
- Кладёшь PNG в папку `art/` в корне проекта с именем из таблицы — игра берёт его вместо сгенерированного.
- Рельеф (карту нормалей) и шероховатость для реалистичных текстур игра **сделает сама из картинки** (`npm run art`).
  Если хочешь свои — `<имя>_n.png` (нормали) и `<имя>_r.png` (шероховатость).
- Шов: если картинка получилась не совсем бесшовной, игра сама сгладит стык.
- **Реалистичные текстуры и небо:** после добавления или замены файла запусти `npm run art`. Команда сделает лёгкие копии
  для игры в `art/web/` (WebP 1024 — компьютер, 512 — телефон) и заранее посчитает рельеф, шероховатость и затенение,
  чтобы браузер не делал этого при каждом запуске. Без неё игра тоже возьмёт картинку, но грузиться будет дольше.
  Пиксельные спрайты (PNG) эта команда не трогает.
- После добавления файла перезапусти сервер (`npm run dev`).

## Реалистичные текстуры — задания для GPT Image
Каждую текстуру — отдельным запросом. Формат ответа: **квадрат 1024×1024, PNG**.
К каждому заданию добавляй общий хвост (ниже), он важен: вид строго сверху, ровный свет, без теней —
иначе в игре свет «задвоится» (своё солнце + нарисованные тени).

**Общий хвост (добавить в конец каждого задания):**
> Seamless tileable texture, perfectly top-down orthographic view, flat even diffuse lighting, no shadows, no specular highlights, no perspective, no vignette, no text, no border. Uniform detail density across the whole square with no focal point, edges must tile seamlessly. Photorealistic, high detail, 1024x1024.

| Файл | Задание (перед хвостом) |
|---|---|
| `grass.png` | Autumn meadow ground seen from directly above: short olive-green and yellowing grass, a few scattered fallen orange and red leaves, tiny dry twigs, small patches of dark soil showing through. |
| `cliff.png` | Vertical cross-section of earth like a cliff face seen straight on: horizontal layers of brown soil and clay, embedded small grey pebbles, thin hanging roots, slightly moist. |
| `soil.png` | Freshly tilled dark brown garden soil seen from directly above, soft parallel furrows, crumbly clumps, a few tiny pebbles, rich and slightly moist. |
| `stone.png` | Weathered grey granite rock surface seen straight on, subtle cracks, speckles, small patches of pale green lichen. |
| `planks.png` | Old weathered wooden wall of horizontal planks, warm light-brown pine, visible wood grain, knots, thin dark gaps between planks, planks about 10 cm tall. |
| `roof.png` | Terracotta clay roof tiles seen straight on, rows of overlapping rounded tiles, warm red-orange, slightly weathered with subtle moss in the gaps. |
| `bark.png` | Oak tree bark close-up seen straight on, deep vertical furrows, dark grey-brown. |
| `leaves.png` | Dense autumn foliage seen straight on, overlapping maple and oak leaves in orange, red and golden yellow, filling the whole frame. |
| `wood.png` | Plain weathered wood grain, planed boards, **neutral light grey color (desaturated)**, visible grain lines and a few knots. (Цвет каждой детали игра задаёт сама, поэтому серый.) |
| `wicker.png` | Tight basket weave of natural willow wicker, light tan, seen straight on. |

Сколько места в игре занимает одна картинка (повторяется дальше): трава, обрыв, доски, черепица — 4×4 клетки;
земля, камень, кора, листва, дерево — 2×2 клетки; плетёнка — 1 клетка.

## Фон — небо по времени суток (`sky.png` / `sky-evening.png`, `sky-morning.png`, `sky-day.png`, `sky-night.png`)
В игре четыре неба — для утра, дня, вечера и ночи; между ними игра плавно переходит сама.
Пока картинки нет, рисуется градиент из config.js → DAYTIME. Ниже — вечернее, за ним — остальные три.

### Вечер (`sky.png` или `sky-evening.png`)
Картинка за островом, во весь экран. Главное — **приглушённая и мягкая**: остров освещён фонарями,
фон не должен с ним спорить (никаких ярких пятен, резких переходов и насыщенных цветов).
Игра сама растягивает её по экрану без искажений, лишнее обрезает по краям — поэтому важное не ставь к краям.

- Формат: **квадрат 1536×1536**, PNG. Общий «хвост» для текстур сюда **не добавлять**.
- Цвета, под которые подобрана сцена (сверху вниз): `#1e2236` → `#3a3450` → `#554457` → `#735a5a`.

**Задание для GPT Image:**
> Muted evening sky backdrop for a cozy video game. Soft painterly gradient from dusty slate blue at the top (#1e2236) through muted lavender (#3a3450, #554457) to faded warm rose-brown near the bottom (#735a5a). Very low contrast and low saturation, calm and hazy. Barely visible soft clouds in the middle, a few faint tiny stars only at the very top. No sun disc, no bright spots, no glow, no horizon line, no landscape, no trees, no buildings, no objects, no text, no border. Slight film grain. Looks like an out-of-focus background behind a brightly lit foreground. Square 1536x1536.

Если выйдет слишком ярко или контрастно — добавь в конец: *even more muted, darker, flatter, less saturated*.

Для утра, дня и ночи — тот же формат (квадрат 1536×1536, PNG), те же правила: мягко, без ярких пятен и солнечного диска
(солнце и луну игра рисует светом, не картинкой). Звёзды на ночное небо игра добавит сама — на картинке их не нужно.

### Утро (`sky-morning.png`)
Цвета сцены (сверху вниз): `#3d3f78` → `#9a6f9e` → `#e38f7c` → `#f5a86a`.
> Soft dawn sky backdrop for a cozy video game. Painterly gradient from muted indigo at the top (#3d3f78) through dusty mauve (#9a6f9e) to warm coral pink (#e38f7c) and soft apricot near the bottom (#f5a86a). Gentle, hazy, low contrast. A few thin soft pink-lit clouds in the lower half. No sun disc, no bright spots, no glow, no horizon line, no landscape, no trees, no buildings, no objects, no text, no border. Slight film grain. Looks like an out-of-focus background behind a lit foreground. Square 1536x1536.

### День (`sky-day.png`)
Тёплый золотой осенний день. Цвета сцены (сверху вниз): `#7d6f93` → `#c98a62` → `#dd9154` → `#e39e62`.
> Warm golden autumn afternoon sky backdrop for a cozy video game. Painterly gradient from soft dusty violet at the top (#7d6f93) through warm terracotta (#c98a62) to glowing amber orange near the bottom (#dd9154, #e39e62). Soft, hazy, cozy, low contrast. A few soft fluffy clouds with warm golden edges in the middle. No sun disc, no bright spots, no horizon line, no landscape, no trees, no buildings, no objects, no text, no border. Slight film grain. Looks like an out-of-focus background behind a lit foreground. Square 1536x1536.

### Ночь (`sky-night.png`)
Цвета сцены (сверху вниз): `#080a16` → `#121633` → `#1d1f3f` → `#2a2742`.
> Calm night sky backdrop for a cozy video game. Painterly gradient from almost black deep navy at the top (#080a16) through dark indigo (#121633, #1d1f3f) to muted dark violet near the bottom (#2a2742). Very dark, soft, low contrast. Faint thin bluish clouds lit by unseen moonlight in the lower half. No stars, no moon disc, no bright spots, no glow, no horizon line, no landscape, no trees, no buildings, no objects, no text, no border. Slight film grain. Square 1536x1536.

## Пиксельные спрайты
Сейчас нарисованы кодом (`src/art/sprite-art.js`). Свой лист — PNG **с прозрачным фоном**, того же размера
и с тем же порядком кадров; кладёшь в `art/` под именем из таблицы. Рельеф (для света фонарей) игра сделает
сама по форме рисунка. Ровная пиксельная сетка, без сглаживания; тёмный контур по краю — по желанию
(в моих рисунках он есть). Земля — нижняя строка кадра, персонаж стоит на ней.

| Файл | Кадр | Лист | Что где |
|---|---|---|---|
| `raccoon.png` | 32×32 | 640×128 (20 колонок × 4 строки) | енот, главный герой — см. ниже |
| `mole.png` | 32×32 | 640×128 (20 колонок × 4 строки) | крот, второй скин — порядок кадров как у енота |
| `plants.png` | 32×40 | 256×440 (8 × 11) | колонки: стадии 0 семечко, 1 росток, 2 куст, 3 спелое; ночью у спелого: 4–5 настороже, 6 замах, 7 удар; строки — морковь, редис, тыква, подсолнух, гриб, затем гибриды: огнекорень, тыква-фонарь, солнечная тыква, лунный гриб, звездоцвет, золотая тыква |
| `fx.png` | 16×16 | 64×32 (4 × 2) | эффекты боя: строка 0 — искра редиса (4 кадра мерцания), строка 1 — вспышка попадания (звёздочка раскрывается и гаснет) |
| `held.png` | 16×16 | 176×16 (11 × 1) | урожай: морковь, редис, тыква, подсолнух, гриб, затем гибриды в том же порядке, что в `plants.png` (в корзинке у енота — уменьшенный; его же уносят духи) |
| `tools.png` | 16×16 | 176×32 (11 × 2) | что енот держит в лапах, рисовать «лицом вправо»: строка 0 — лейка (носик вправо), корзинка сзади (ручка и тёмное нутро), корзинка спереди (плетёный бок; между задом и передом игра кладёт собранные овощи), 2 пустые клетки; строка 1 — мешочек с семенами, по колонке на растение (морковь, редис, тыква, подсолнух, гриб, затем гибриды) |
| `decor.png` | 16×24 | 128×24 (8 × 1) | колонки 0–2 пучки травы, 3–5 цветы, 6–7 высокая трава |

**Герой (`raccoon.png`, `mole.png`)** — у всех скинов один порядок кадров. Колонки:
- 0–3 — стоит (дыхание, 3 кадра в секунду);
- 4–9 — идёт (10 кадров в секунду);
- 10–13 — действует: сажает, поливает, собирает;
- 14–19 — несёт (лапы перед собой; инструмент рисуется отдельно из `tools.png`).

Строки:
- 0 — к зрителю;
- 1 — смотрит влево (профиль);
- 2 — вправо (зеркало строки 1);
- 3 — от зрителя (спиной).

Светящиеся места (шляпка гриба) в своём рисунке пока не светятся. Если нужно, добавлю файл-маску свечения.
Для GPT Image пиксель-арт не заказываем: он плохо держит ровную сетку и одинаковые кадры анимации.
