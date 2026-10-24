# Dependency audit — 2026-10-20

Команда:

```text
npm audit --omit=dev --ignore-scripts --json
```

Базовый результат до patch pilot: `exit 1`, 8 advisory: 0 Critical, 7 High,
1 Moderate.

После точечного production override для цепочки
`@nextui-org/theme` → `tailwindcss` → `sucrase` → `glob` → `minimatch` →
`brace-expansion@2.1.7`, а также overrides для
`postcss-selector-parser@6.1.3` и `source-map-js@1.2.2` результат:
`exit 1`, 0 Critical, 5 High, 2 Moderate (7 всего).

Основная незакрытая цепочка — `tailwindcss@3.4.9` →
`chokidar`/`fast-glob`/`micromatch` → `braces`; npm предлагает
`tailwindcss@4.3.3`, то есть breaking migration. После pilot остались
`braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss` и moderate
`postcss-nested`/`postcss-selector-parser`.

Полный audit с dev-зависимостями также остаётся красным: 15 advisory,
14 High и 1 Moderate. Поэтому dependency gate не закрыт.

## Решение

- `npm audit fix --force` не запускался: он меняет major CSS toolchain без
  отдельного визуального и build-пилота.
- Runtime после lockfile update подтверждён версиями
  `postcss-selector-parser@6.1.3`, `source-map-js@1.2.2` и
production `brace-expansion@2.1.7` (dev ESLint-цепочка сохраняет
совместимый `brace-expansion@1.1.21`); test/typecheck/lint/build/bundle проходят.
- Безопасный следующий slice: изолированный Tailwind 4 migration с проверкой
  PostCSS, NextUI, all CSS layers, screenshot regression и rollback.
- React/TypeScript/Vite/SDK major upgrades не смешивать с этим migration.
- До зелёного production audit не открывать public beta, billing или
  marketplace.
