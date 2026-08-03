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
ДЕМО:            https://dnd.eclipse-forge.ru/

СТЕК
React 18 · TypeScript · Vite 5 · Tailwind · @xyflow/react · Slate ·
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
- Каждый коммит: conventional commit; сообщение объясняет одну законченную причину изменения.
- После значимого слайса: commit + push в main.
- Деплой: workflow `.github/workflows/deploy.yml` автоматически запускается на push
  в `main`. Сначала read-only job выполняет locked install, typecheck, tests, lint и
  build, затем отдельный write-scoped job публикует проверенный artifact в `gh-pages`.
  Все actions pinned полными SHA; community publisher не используется.

ОКРУЖЕНИЕ / ГРАББЛИ
- Bash-тул может быть недоступен — использовать PowerShell (Windows
  PowerShell 5.1: нет `&&`, нет `2>&1` на нативных exe, here-string `@'...'@`
  с закрывающим `'@` на 0-й колонке).
- Устанавливать зависимости только через `npm ci --ignore-scripts --no-audit`.
  Перед коммитом обязательны `npm run typecheck`, `npm test`, `npm run lint` и
  `npm run build`; strict mode и noUnusedLocals/Parameters включены в tsconfig.
- Все cloud keys (OpenAI/Anthropic) — только в sessionStorage текущей вкладки,
  никогда не в URL/localStorage/Vite env. Browser-direct доступ остаётся demo-only;
  production требует backend gateway.

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

ТЕКУЩЕЕ СОСТОЯНИЕ (на 2026-08-03)
v0.3 содержит 27 слайсов:
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
  slice 21    — автономный game loop
  slice 22    — auto-routing боя и world-tick
  slice 23    — безопасный Azgaar Minimal JSON workflow
  slice 24    — CI type-safety baseline и безопасный study renderer
  slice 25    — доступная responsive-панель карты
  slice 26    — session-only BYOK и mobile workspace
  slice 27    — изолированный GitHub Pages publisher

Что есть в продукте:
  - 5 типов агентов: NpcAgent, DmAgent, CombatAgent, WorldTickAgent,
    SessionRecapAgent — на единой архитектуре
  - 3 провайдера + FallbackProvider, streamChat + generateStructured
  - Persistent living-world loop: World Tick → авто-scheduling → DM-awareness
    → cross-reference в чат-истории NPC
  - Сессии с AI-recap'ами → блок «PREVIOUSLY ON THIS CAMPAIGN» в DM-промпте
  - Классические DM-инструменты: NPC/Encounter генераторы, трекер инициативы,
    кубики, HP/danger/ability слайдеры с AI-rewrite сцены
  - Azgaar workflow: brief → официальный редактор → bounded Minimal JSON preview
    → импорт location nodes без дублей
  - Mobile workspace без scroll-jump: один явный режим «Текст» / «Мир»
  - 4 seed-кампании (Фандалин / Баровия / Синдер-Холлоу / Пустая)
  - UI полностью на русском

Перед работой сверить `git status`, `git log -5` и последний Actions run; демо:
https://dnd.eclipse-forge.ru/.

АКТИВНЫЙ СЛОТ В ROADMAP — свободен.

ОТКРЫТЫЕ FOLLOW-UPS (мелкие, в ROADMAP → «Следующее»):
  - P1 / M production AI gateway: user auth, server-side provider secrets,
    per-user budgets, rate limits, audit metadata без prompt/response logging
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
  - browser-direct cloud providers остаются demo-only до production gateway

ЗАДАЧА
Сначала определить, существует ли в Eclipse Forge готовый production AI gateway,
который можно переиспользовать без копирования auth/budget/rate-limit логики.
Зафиксировать contract и trust boundaries в ROADMAP; не переносить provider secret
в браузер и не логировать prompts/responses. Реализацию начинать только в реальном
runtime-репозитории, а не добавлять фиктивный backend в статический Pages app.

Сначала прочитай ROADMAP.md и README.md, потом отвечай.
```

---

## Как пользоваться

1. Открыть новый чат Claude Code в `E:\projects\eclipse-dnd-forge`.
2. Вставить **блок 1** (промпт настройки) — калибрует агента.
3. Вставить **блок 2** (сообщение для нового чата) — даёт состояние + задачу.
4. Агент прочитает ROADMAP.md / README.md и предложит направление.
