# DnD mascot preview — status

Дата проверки: 23.10.2026
Статус: `local / не опубликовано`

## Что принято в этом checkout

- На welcome-экране остаётся оригинальный `dnd-kverk` («Кверк»), версия
  `kverk-v0.1.0`.
- Добавлен маршрут `#/mascots-preview`: пять статичных состояний `idle`,
  `greet`, `curious`, `delight`, `rest`, подписи смысла, provenance и
  безопасный текстовый fallback.
- Preview не читает Campaign, AI provider, ACL, event log или player state.
  Состояние маскота — только ручной просмотр эскиза.
- Все SVG загружаются из `public/mascots/kverk-v0.1.0/`; внешний CDN, Koboyo,
  реальные лица и D&D-ассеты не используются.

## Источники и границы

- Google Sheet [Eclipse Forge → Идеи и внедрение → IDEA-028](https://docs.google.com/spreadsheets/d/1VpEVU34TXIJj_CKwzD8tNhpRYHXt1hUXUv8j9jvB14I/edit#gid=450001): для DnD указан узкий welcome-компонент без перекрытия карты и без изменения campaign/ACL/legal cleanup.
- Google Sheet [Бэклог → IDEA-028-DND](https://docs.google.com/spreadsheets/d/1VpEVU34TXIJj_CKwzD8tNhpRYHXt1hUXUv8j9jvB14I/edit#gid=105&range=A57:J57): статус — локальный пилот, не production-приёмка.
- Общий контракт маскотов: `E:/projects/EclipseForgeLanding/docs/eclipse-forge-os/design/mascots/CONTRACT.md`.
- В Library есть отдельная галерея Koboyo и отдельный оригинальный mascot-контракт
  Library. Эти материалы не копируются в DnD; текущая графика имеет
  `LicenseRef-Eclipse-Internal-Review` и разрешена только для локальной примерки.

## Проверки

- `node --experimental-strip-types --test tests/mascot-preview.test.mjs tests/welcome-familiar.test.mjs` — **7/7 PASS**.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run build` — **PASS**; собран отдельный chunk `MascotPreview`.
- Headless browser QA не подтверждён: sandbox не разрешил локальный CDP/loopback
  (`EACCES`/`ERR_CONNECTION_TIMED_OUT`). Нужен повтор в разрешённом локальном
  браузерном контуре для desktop/mobile screenshot и проверки реального перехода.

## Следующий безопасный шаг

После browser QA можно отдельно решить, нужен ли второй оригинальный DnD-образ.
До этого не импортировать Koboyo и не объявлять `dnd-kverk` публично
лицензированным production asset.
