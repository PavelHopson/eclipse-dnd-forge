# IDEA-029-DND — Зал угасшего маяка

Дата проверки: 2026-10-10. Изолированный local preview, не релиз DnD.

## Результат и границы

Небольшая оригинальная WebGL-комната: жаровня включает тёплый точечный свет,
сундук открывает крышку и показывает медную печать, решётка поднимается над
проёмом. Выбор мышью прямо в сцене (ray/AABB) или доступными кнопками.
Камера: ограниченные orbit, pan, zoom; мышь, touch, клавиатура и кнопки.
Сброс возвращает одновременно предметы и камеру. После reload состояние новое.

Использован установленный Vite 7.3.6 и native WebGL, без Three.js: его нет в
dependencies проекта, добавлять библиотеку ради этой комнаты не потребовалось.
Ни одного изменения существующих файлов. Main UI не импортирует preview;
обычный build приложения не включает папку experiments. Нет кампаний, ACL,
AI recovery, Reference Board, аккаунтов, storage или вызовов моделей.

`accessible-animation` определил поведение reduced-motion: отключено drag/колесо,
остались дискретные кнопки и клавиатура; preference меняется без reload.
Нет автоматической анимации, инерции или постоянного RAF. В скрытой вкладке
отрисовка остановлена. На pagehide отменяется RAF, снимаются listeners через
AbortController, отключается ResizeObserver и удаляются GL buffer/program/shaders.
Наблюдения по CPU не являются подтверждением 60 FPS.

## Изученный источник

- [Genex Desktop](https://genex.games/desktop), проверено 2026-10-10: browser-game
  workflow, запуск и визуальная проверка маленькой сцены. Windows, Unity и Unreal
  обозначены как будущие возможности.
- [Официальный репозиторий](https://github.com/genex-games/genex-desktop).
- [Страница релиза v0.1.5](https://github.com/genex-games/genex-desktop/releases/tag/v0.1.5).
  Код tag не импортировался; короткий SHA из поручения не использован как локальное
  доказательство. Genex не установлен, его конфигурация, навыки и код не копировались.

Все формы, материалы, GLSL, тексты и компоновка комнаты созданы в рамках этого
пилота. Нет скачанных assets, музыки, шрифтов, моделей или платной генерации.

## Точный write-set — 7 новых файлов

1. `experiments/idea-029-room/index.html` — отдельная страница и доступные controls.
2. `experiments/idea-029-room/room.css` — desktop/mobile оформление.
3. `experiments/idea-029-room/scene.mjs` — оригинальная геометрия, камера, picking.
4. `experiments/idea-029-room/room.mjs` — renderer, input, состояния и cleanup.
5. `experiments/idea-029-room/scene.test.mjs` — focused regression.
6. `experiments/idea-029-room/qa.mjs` — localhost-only headless browser regression.
7. `docs/IDEA-029-DND-ROOM-STATUS.md` — этот статус.

Git root подтверждён: `E:/projects/eclipse-dnd-forge`, ветка `main`.
Локальная запись origin/main на начало: behind 2; fetch не выполнялся.
55 ранее modified/untracked файлов проверены по SHA256 — все без изменений.
AGENTS, память, central registry и Google Sheets не изменялись.

## Запуск — Windows PowerShell

```powershell
Set-Location E:\projects\eclipse-dnd-forge
node node_modules/vite/bin/vite.js experiments/idea-029-room --host 127.0.0.1 --port 5209 --strictPort
```

Открыть `http://127.0.0.1:5209/`. Остановка — Ctrl+C в этом терминале.
Если порт занят, остановиться и выяснить владельца; чужой процесс не завершать.
`file://` для ES modules не является поддержанным способом запуска.
Sandbox блокировал localhost: реальный runtime проверен после разрешения доступа
и запуска только своего loopback-сервера через штатный approval.

## Проверки

```powershell
node --test experiments/idea-029-room/scene.test.mjs
node --check experiments/idea-029-room/room.mjs
node --check experiments/idea-029-room/qa.mjs
node node_modules/vite/bin/vite.js build experiments/idea-029-room --outDir C:/Users/garaa/Documents/Codex/2026-08-23/dnd/idea-029-room-build
```

- Focused tests: **6/6 PASS**, syntax checks PASS.
- Standalone production build: PASS. Основной build/typecheck/lint/full suite не
  запускались заново: их исходники, конфигурация и зависимости не менялись;
  прошлые результаты не считаются проверками этого пилота.
- Собственный dev server остановлен и заменён static preview собранной версии
  на том же порту. Browser harness прошёл **12/12 и в dev, и на compiled build**.
- `git diff --check` PASS; targeted secret-pattern scan новых файлов — без совпадений.

Browser QA: отдельный headless Edge с одноразовым `idea029-room-*` профилем,
CDP 9249, desktop 1440×1100, mobile 390×844. Команда после запуска такого QA browser:

```powershell
$env:QA_SCREENSHOT_DIR='C:\Users\garaa\Documents\Codex\2026-08-23\dnd\idea-029-room-2026-10-10\built'
node experiments/idea-029-room/qa.mjs 9249
```

Проверены: видимая WebGL-сцена; отсутствие idle loop; mouse picking всех трёх
предметов; keyboard camera/reset/Tab/Enter/focus; mouse drag; touch item/drag;
resize без горизонтального overflow; live reduced-motion и tap после drag;
background tab; reload; реальная потеря контекста через WEBGL_lose_context и retry;
отсутствующий WebGL через fault injection getContext=null и retry; pagehide cleanup;
отсутствие uncaught JS errors и внешних HTTP requests.
Отдельно осмотрено через Codex in-app browser: desktop/mobile, три предмета,
клавиатура. Это не физический touchscreen и не Safari/Firefox coverage.

Первый QA вариант отправлял touch drag тремя практически одновременными событиями:
Chromium не выдавал последующий compatibility click. Harness исправлен на
330-мс жест с промежуточными move; последующий touch на кнопке проверен успешно.
Product click-handler не заменялся искусственной обработкой pointerup на кнопках.

## Вес и наблюдаемая производительность

Standalone build, decimal kB по Vite:

| Ресурс | Raw | Gzip |
| --- | ---: | ---: |
| HTML | 4.28 kB | 1.86 kB |
| CSS | 3.39 kB | 1.35 kB |
| JS | 12.08 kB | 5.62 kB |
| Всего | 19.75 kB | 8.83 kB |

Нет image/model/font downloads. DPR ограничен 1.5; один drawArrays на изменение,
примерно 6.4k вершин. Idle/background — нет повторяющихся кадров.
В 20 camera actions CPU command submission: median **0.1 ms**, p95 **0.2 ms**
в данной локальной QA-среде (и dev, и compiled run). Это НЕ GPU duration,
end-to-end latency, FPS или гарантия производительности на других устройствах.

## Evidence и ограничения

Скриншоты и JSON receipt вне репозитория:
`C:/Users/garaa/Documents/Codex/2026-08-23/dnd/idea-029-room-2026-10-10/built/`:
`room-desktop.png`, `room-interactions.png`, `room-mobile.png`,
`room-reduced-motion.png`, `room-context-lost.png`, `room-no-webgl.png`, `receipt.json`.

Proportional security review: нет произвольных URL/HTML, dynamic eval, upload,
идентификаторов пользователя или persistent data; DOM text через textContent;
CSP self-only, loopback-only server, нет внешних runtime-зависимостей.
Critical/High/Medium findings в этом узком write-set не обнаружены;
это не аудит безопасности основного приложения. Исходные нерешённые риски DnD
и ранее не принятый A09 остаются отдельными задачами.

Это cutaway room study, не walking simulator: pan/orbit не являются перемещением
персонажа; отсутствуют коллизии, навигация между комнатами, физика, звуки,
динамические тени, persistence и интеграция с игровыми сессиями.
Picking использует bounding boxes предметов, без полного occlusion engine.

**Local:** реализовано. **Runtime:** проверено локально, включая compiled preview.
**Merged:** нет. **Deployed/published:** нет. Commit/push/deploy не выполнялись.
Пилот не разрешает публикацию карт/Reference Board или другие прежние изменения.

Cleanup завершён: собственные dev/static preview процессы остановлены, порты
5209/9249 закрыты, QA Edge закрыт после проверки точного user-data-dir. Единственный
одноразовый профиль с синтетическими данными удалён; пользовательские профили
не затрагивались. Временная IAB-вкладка закрыта, viewport override сброшен.
Скриншоты, receipt и самостоятельная сборка оставлены как evidence.

## 2026-10-11 — локальный монтажный тест Tesseract / IDEA-030-DND

Продолжение существующей комнаты IDEA-029, без новой сцены и без изменения кода
игры. Учёт: A-00, IDEA-030-DND, «Бэклог» строка 64; реестр ведёт только A-00.

BT.709-копия исходника принята координатором:
`G:/media-production/tesseract-pilot-20261011/dnd-input/dnd-room-tesseract-720p30-bt709.mp4`.
Provenance и проверка этой копии:
`G:/media-production/tesseract-pilot-20261011/dnd-input/bt709-copy-receipt.json`.

Координатор сообщил о готовности локального монтажного теста:

- Редактируемый проект: `G:/media-production/tesseract-pilot-20261011/dnd/Dungeon-Intro.tsrct`.
- Ролик: `G:/media-production/tesseract-pilot-20261011/dnd/Dungeon-Intro.mp4`.
- 1280×720, 30 fps, 10 s, 300 кадров.
- Нативные RU/EN fade-in титры: «ЗА РЕШЁТКОЙ / A dungeon awaits»;
  финал: «ПУТЬ ОТКРЫТ / Your story starts here».
- Отдельная оригинальная синтезированная атмосфера, акценты на 3.2 и 7.7 s.
- Переданные проверки координатора: full decode PASS, visual contact sheet PASS,
  loudness −18.8 LUFS. Прямое прослушивание ещё не выполнено.

В этом обновлении независимо подтверждено только наличие обоих файлов:
`.tsrct` — 2 846 104 bytes, `.mp4` — 2 527 854 bytes. Рендер, decode, loudness
и visual review не повторялись; выше они явно записаны как результаты координатора.
30 fps — частота итогового видео, не измерение FPS игрового runtime.

**Статус:** локальный монтажный тест готов к пользовательскому просмотру и
прослушиванию, но ещё не принят пользователем. Следующий шаг — посмотреть ролик
со звуком, оценить атмосферу/громкость/акценты и выбрать сюжетное название;
текущие титры не считаются окончательным утверждённым названием.

Adobe/Premiere compatibility и production-готовность не заявляются. Новые
рендеры и публикация не требуются до обратной связи пользователя. Код игры,
Google Sheets, память и инструкции не менялись; commit/push/deploy не выполнялись.
