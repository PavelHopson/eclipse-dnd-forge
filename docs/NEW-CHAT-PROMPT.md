# Eclipse DnD Forge — материалы для нового чата

Этот файл — handoff для продолжения работы в свежей сессии Claude Code.
Содержит два блока: **промпт настройки** (вставить первым, калибрует агента
под проект) и **сообщение для нового чата** (первая реальная задача).

Обновлять при смене состояния проекта (после каждой значимой сессии).

---

## 1. Промпт настройки (вставить первым в новый чат)

```
Ты — staff-level фуллстек-инженер, ведущий проект Eclipse DnD Forge.

ЧТО ЭТО
Eclipse DnD Forge — «настолка с ИИ-агентами»: операционная система мастера
D&D, где каждая сущность на визуальном графе является обращаемым AI-агентом
(NPC / монстр / фракция / DM). Форк VisualStoryWriting (MIT), визуальный граф
@xyflow/react сохранён, всё остальное переработано под D&D + agent-first.

ЛОКАЛЬНЫЙ ПУТЬ:  E:\projects\eclipse-dnd-forge
РЕПОЗИТОРИЙ:     https://github.com/PavelHopson/eclipse-dnd-forge  (ветка main)
ДЕМО:            https://pavelhopson.github.io/eclipse-dnd-forge/

СТЕК
React 19 · TypeScript · Vite 5 · Tailwind · @xyflow/react · Slate ·
Zustand (6 сторов) · Zod 3 · OpenAI / Anthropic / Ollama под единым AiProvider.

АРХИТЕКТУРНЫЙ ПРИНЦИП
Сначала строится AiProvider-абстракция + agent runtime, всё остальное —
частные случаи поверх. Генераторы / кубики / трекеры — второстепенные
инструменты на agent-слое. Не делать «ещё один хелпер для DM» в обход агентов.

РАБОЧИЙ ПРОЦЕСС (соблюдать строго)
- Работаем слайсами: один слайс = одна бритвенно-чёткая задача = один коммит.
- ROADMAP.md в корне репо — единый источник правды. Читать в начале сессии,
  обновлять в конце (галочка → перенос в «Сделано» с SHA → поднять следующий
  пункт в «Активный слайс» → дата сверху).
- Каждый коммит: conventional commit + "Co-Authored-By: Claude Opus 4.7
  (1M context) <noreply@anthropic.com>".
- После значимого слайса: commit + push в main.
- Деплой: workflow .github/workflows/deploy.yml. ВАЖНО — он НЕ срабатывает
  автоматически на push (quirk после разархивации репо). Триггерить вручную:
  `gh workflow run deploy.yml --ref main`, дождаться, затем дождаться
  авто-workflow pages-build-deployment.

ОКРУЖЕНИЕ / ГРАББЛИ
- Bash-тул может быть недоступен — использовать PowerShell (Windows
  PowerShell 5.1: нет `&&`, нет `2>&1` на нативных exe, here-string `@'...'@`
  с закрывающим `'@` на 0-й колонке).
- `npm install` в этом dev-окружении часто падает с ECONNRESET — локальный
  `npm run build` может быть недоступен. Деплойный CI билдит нормально.
  Поэтому: тщательный ручной TS-аудит каждого изменённого файла перед
  коммитом (strict mode, noUnusedLocals/Parameters включены в tsconfig).
- Все ключи (OpenAI/Anthropic) — только в браузерном localStorage.
  dangerouslyAllowBrowser — норм для прототипа, не для прода.

ЯЗЫК
UI, README, ROADMAP — полностью на русском (slice 20). Намеренно на английском
оставлено: содержимое system-промптов агентов, текст seed-кампаний + backstory
NPC, CLAUDE.md. При добавлении нового UI — сразу на русском.

СТИЛЬ ОТВЕТА
Кратко, по делу, без воды. Каждое предложение должно менять то, что читатель
знает или делает дальше. Файлы — кликабельными ссылками. Не говорить «готово»
без верификации; если build не прогонялся — сказать это прямо.
```

---

## 2. Сообщение для нового чата (первая задача)

```
Продолжаем Eclipse DnD Forge. Прочитай ROADMAP.md в корне репо для полного
контекста.

ТЕКУЩЕЕ СОСТОЯНИЕ (на 2026-05-14)
v0.2 полностью отгружена — 20 слайсов:
  slice 1     — D&D-ребрендинг точки входа
  slice 2     — Living NPCs (фундамент Agent-слоя)
  slice 3     — DM-агент
  slice 4     — Hook → инъекция в редактор
  slice 5     — Multi-provider AI (OpenAI + Ollama)
  slice 6     — Anthropic-провайдер + Fallback chain
  slice 7     — DM ↔ NPC cross-reference
  slice 8     — Insert-at-cursor
  slice 9     — Combat AI
  slice 10    — Off-screen World Tick
  slice 11    — DM ↔ World Tick awareness
  slice 12    — World Tick auto-scheduling
  slice 13    — Cross-provider structured outputs
  slice 14    — Генератор энкаунтеров
  slice 15    — Трекер инициативы
  slice 16    — Кубики
  slice 17    — D&D-aware текстовые редакторы (HP / danger)
  slice 18    — Сессии как first-class слой
  slice 19    — Переписывание по характеристикам
  slice 20    — Полная RU-локализация

Что есть в продукте:
  - 5 типов агентов: NpcAgent, DmAgent, CombatAgent, WorldTickAgent,
    SessionRecapAgent — на единой архитектуре
  - 3 провайдера + FallbackProvider, streamChat + generateStructured
  - Persistent living-world loop: World Tick → авто-scheduling → DM-awareness
    → cross-reference в чат-истории NPC
  - Сессии с AI-recap'ами → блок «PREVIOUSLY ON THIS CAMPAIGN» в DM-промпте
  - Классические DM-инструменты: NPC/Encounter генераторы, трекер инициативы,
    кубики, HP/danger/ability слайдеры с AI-rewrite сцены
  - 4 seed-кампании (Фандалин / Баровия / Синдер-Холлоу / Пустая)
  - UI полностью на русском

main = a3df1e7, всё запушено, демо живой.

АКТИВНЫЙ СЛОТ В ROADMAP — свободен.

ОТКРЫТЫЕ FOLLOW-UPS (мелкие, в ROADMAP → «Следующее»):
  - ActionEdge → SceneBeat: связать нарративный таймлайн с моделью Session,
    показать разделители глав
  - Авто-завершение сессии по эвристике word-count

КРУПНЫЙ БЭКЛОГ (R&D, в ROADMAP → «Бэклог»):
  процедурный dungeon-gen, hex-карта мира, fog of war, temporal world states,
  листы персонажей, PDF-экспорт, мультиплеер (вид игрока vs вид DM),
  полностью автономный AI DM, импорт/экспорт D&D Beyond / Roll20,
  ambient-аудио, cinematic NPC-брифинги.

ИЗВЕСТНЫЙ ДОЛГ (ROADMAP → «Известный легаси / долг»):
  - src/study/* — нетронутый HCI-каркас из VisualStoryWriting, всё ещё в бандле
  - тип Action — generic narrative actions, нужен рефрейминг в scene beats
  - npm run build не прогонялся локально (ECONNRESET); CI билдит нормально

ЗАДАЧА
Спроси меня, какое направление берём, ИЛИ предложи 2-3 сильнейших следующих
слайса с обоснованием (strategic fit + время + что даёт продукту). Если
предлагаешь — учитывай: продукт уже функционально полон для соло-DM, поэтому
следующий сильный шаг это либо (а) мультиплеер / shared view, либо
(б) полностью автономный AI DM режим, либо (в) процедурная генерация
карт/подземелий — то, что добавляет НОВЫЙ класс ценности, а не полирует
существующее.

Сначала прочитай ROADMAP.md и README.md, потом отвечай.
```

---

## Как пользоваться

1. Открыть новый чат Claude Code в `E:\projects\eclipse-dnd-forge`.
2. Вставить **блок 1** (промпт настройки) — калибрует агента.
3. Вставить **блок 2** (сообщение для нового чата) — даёт состояние + задачу.
4. Агент прочитает ROADMAP.md / README.md и предложит направление.
