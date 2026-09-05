# Atlas editing — resize, selection, layers

- Date: 2026-09-05. Checkout: `E:/projects/eclipse-dnd-forge`, existing `main`, baseline `9f33757` plus preserved dirty work.
- Scope: original Atlas object resizing, multi-selection transforms and bounded local layers; no Reference Board / Living World UI changes or dependencies in the editing slice.
- Реализовано и проверено локально. Предыдущий слайс: [MAP-WORKSPACE-STATUS.md](MAP-WORKSPACE-STATUS.md).

## Подготовка публикации — 2026-09-05

- После реализации пользователь явно разрешил загрузку изменений. Цель: существующая `main` в `https://github.com/PavelHopson/eclipse-dnd-forge.git`; новая ветка не создаётся.
- Пакет включает взаимозависимые, ранее проверенные слайсы: Living Atlas, campaign reliability, Map Workspace и layered editing, их tests/QA scripts и handoff/audit документы. Отдельные PDF, `docs/assets/`, `docs/design/`, обзор проекта и PDF renderer остаются локальными, вне commit.
- Перед commit повторены 110 tests, typecheck, lint, build и bundle budget; сохранены свидетельства 29 browser scenarios с предыдущего шага на том же продуктовом коде. Повторный npm audit: прежний Low advisory без изменений зависимостей.
- В `main` настроен штатный GitHub Actions workflow для build/publish Pages; push не является доказательством успешного CI или production-проверки. Фактическую доставку commit подтверждает remote Git ref, результат сайта проверяется отдельно.

## Реализация и решения

- Комнаты: четыре угловые ручки, ширина/высота в клетках; стены и коридоры: две конечные точки и числовые координаты. Ручки доступны клавиатурой. Размер двери остаётся фиксированным, ориентация — 0/90°.
- Выделение рамкой по пересечению логических границ, Shift + клик, кнопка «Несколько» и «Выбрать всё» / Ctrl+A. Перемещение и удаление группы — одна операция истории; общий clamped delta сохраняет расстояния между объектами у края холста.
- До 12 слоёв: создать, переименовать, скрыть, заблокировать, переставить, перенести выделенные объекты; удалить можно только пустой незаблокированный дополнительный слой. Базовый слой сохраняется всегда.
- Старые v1 документы остаются без обязательной перезаписи и используют стабильный implicit `layer-base`. Новые optional поля `layers` / `layerId` строго проверяются вместе с source-маркером, ссылками, boolean-флагами, дубликатами и прежними лимитами 500 объектов / 1 МБ. Ранние сборки без поддержки слоёв могут отклонить новые проекты — обратная совместимость заявлена только для чтения старых проектов новой сборкой.
- Слои рисуются снизу вверх; непрерывный пол и дверные проёмы объединяются **внутри** одного слоя. Поэтому комнаты/коридоры одного этажа стоит держать вместе; дверь другого слоя не вырезает чужую стену.
- Скрытые слои отсутствуют в PNG/WebP и в hit targets. **Это не ACL и не режим секретных данных**: файл проекта, локальное сохранение и master backup содержат все слои. UI предупреждает об этом.
- Группы — текущее выделение, не постоянные именованные группы. Слой/размер/порядок сохраняются вместе с прежним map ID, геометрией и preview через существующий атомарный путь.
- Исправлены найденные QA проблемы: сжатая до нуля кнопка в мобильном scroll-inspector; дочерние keyboard/click handlers во время busy export; ложное значение поля после отклонённого схлопывания линии. Ошибка импорта теперь объясняется по-русски и сохраняет текущую карту.

## Проверки

- `npm test`: **110/110 pass** (10 новых focused tests в `tests/atlas-editing.test.mjs`).
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run bundle:check`: pass. Initial graph 580.4 KiB; largest deferred chunk 290.7 KiB.
- `node scripts/qa-atlas-editing.mjs 9231 http://127.0.0.1:5197/`: **9/9 pass** на финальной сборке. Native pointer/keyboard; размеры и отклонённый collapse; busy guard; групповая история; реальные raster pixels для порядка слоёв; actual PNG SVG source; lock/visibility; перенос; save/reload и malformed import; mobile hit targets.
- Визуально просмотрены desktop 1440×1000 и mobile 390×844: холст и панель слоёв. Это headless Edge/Chromium QA с отдельным временным профилем, синтетическими кампаниями и запрещёнными downloads; платные/реальные AI-запросы не выполнялись.
- На той же финальной сборке повторены `node scripts/qa-map-workspace.mjs 9231 http://127.0.0.1:5197/` — **8/8 pass**, и `node scripts/qa-campaign-reliability.mjs 9231 http://127.0.0.1:5197/` — **12/12 pass**. Всего **29** браузерных сценариев.
- Собственные QA preview (5197) и headless browser (9231) остановлены; проверено отсутствие listeners. Созданный этой задачей временный профиль с синтетическими данными удалён после exact-path / non-reparse проверки; данные воспроизводимы тестовыми скриптами. Другие процессы и пользовательские профили не затрагивались.
- `git diff --check`: pass; review применённых patch hunks и файлов. Heuristic secret scan: 58 изменённых/новых текстовых файлов, совпадений нет; бинарные PDF/assets не сканировались. Это regression guard, не гарантия отсутствия секретов.
- `npm audit --omit=dev --ignore-scripts`: exit 1, **один прежний Low**, `postcss-selector-parser` / GHSA-w9m9-85wc-3x92. Зависимости не менялись, advisory не закрыт.
- Пропорциональная проверка по `conducting-api-security-testing`: allowlisted import и nested backup validation, данные остаются локальными, layers не дают rights approval; новых URL/network/HTML rendering surfaces нет. Critical/High/Medium findings в изменённой поверхности не обнаружены; это не внешний pentest.

## Ограничения и следующий шаг

- Не проверялись физический touch/stylus, Safari/Firefox, screen reader, длительные сессии на 500 объектах и production. Desktop/mobile — viewport emulation, не сертификация доступности.
- Нет масштабирования/поворота всей группы, постоянных групп, boolean cutouts, кривых стен, hex, fog/light, cloud/IndexedDB. Сохраняются лимиты localStorage и отдельные транзакции удаления карты/меток из предыдущего слайса.
- IP/trademark/commercial gates и прежний Low advisory остаются отдельными открытыми задачами. Код/дизайн/assets сторонних редакторов не заимствовались.
- Следующее безопасное действие: выбрать отдельный слайс — геометрические вырезы/кривые или постоянные группы/масштабирование группы; физический touch и доступность проверить перед релизом. Commit/push — только по отдельной команде пользователя.
