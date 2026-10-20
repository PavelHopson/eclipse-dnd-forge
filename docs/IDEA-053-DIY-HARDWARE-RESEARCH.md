# IDEA-053 — DIY-реквизит для Eclipse DnD Forge

Дата: 2026-10-20
Статус: `План / research only`
Ограничение: ничего не покупалось, не публиковалось и не добавлялось в код.

## Короткий вывод

Каталог «You can just build things [with hardware]» хорошо подтверждает четыре
направления для Forge: физический голосовой familiar, постоянный world-memory
реквизит, простой DM status display и shared scene на проекторе. Самый безопасный
первый шаг — локальная экранная симуляция реквизита внутри существующего VTT;
она проверяет игровой эффект без железа, аккаунтов, микрофона по умолчанию и
внешней публикации.

Ни один community-проект ниже нельзя копировать в Eclipse Forge автоматически.
Каталог даёт продуктовые паттерны и иногда исходную ссылку, но не заменяет
проверку лицензии, attribution, trademark и права на ассеты.

## Отобранные идеи

### 1. Taz — Taskagotchi: голосовой familiar партии

- **Игровой сценарий:** маленький экранный/настольный familiar слушает короткую
  реплику игрока, меняет выражение и состояние (`слушает`, `думает`, `опасность`,
  `готов`); ведущий может использовать его как diegetic messenger или сигнальный
  объект мира.
- **Компоненты из карточки:** ESP32-S3 N16R8, OLED 1.5", INMP441 I2S mic,
  MAX98357-series amplifier, 3W 8Ω speaker, jumper wires, USB power.
- **Исходники/инструкция:** карточка содержит краткую wiring/firmware историю,
  но публичного source repository не указано; есть только social profile автора.
- **Сложность:** medium-high: audio streaming, echo/latency, firmware и питание.
- **Приватность:** микрофон может постоянно слышать комнату; нужны push-to-talk,
  явный индикатор записи, локальное удаление аудио и запрет хранения сырых записей.
- **Лицензирование:** исходный код, pixel art и voice assets не подтверждены;
  не использовать напрямую.
- **VTT-замена:** avatar/familiar в Player View, Web Audio tones и локальный
  `SpeechSynthesis`; состояние меняется от событий Campaign, без микрофона.
- **Источник:** https://youcanjustbuildthings.openai.chatgpt.site/#projects

### 2. Dream Logger: визуальный дневник снов как living-world memory

- **Игровой сценарий:** после сессии игрок диктует короткий «сон мира» или
  фрагмент воспоминания; система делает четыре оригинальных storyboard-сцены,
  сохраняет их в календарь и позже возвращает повторяющиеся мотивы в world recap.
- **Компоненты из карточки:** M5Stack CoreS3 SE (K128-SE) с mic/touch/Wi-Fi,
  USB-C и power bank.
- **Исходники/инструкция:** подробная карточка: Arduino ESP32, M5Unified,
  M5GFX, 16 kHz WAV, OpenAI transcription/image edit, FFat, HTTPS companion API.
  Public repo не указан; ссылка ведёт на X-пост автора.
- **Сложность:** high: embedded UI, audio/image buffers, retries, storage,
  calendar API и стоимость provider calls.
- **Приватность:** голос, личные сны, изображения и календарная история — sensitive;
  нужен local-first режим, TTL, explicit save и отсутствие публикации по умолчанию.
- **Лицензирование:** prompt, generated images, companion API и возможные
  reference images требуют отдельной provenance/rights записи.
- **VTT-замена:** Session Recap принимает текст, генерирует 4 локальные карточки
  сцены и привязывает их к campaign timeline; без hardware и без фоновой загрузки.
- **Источник:** https://youcanjustbuildthings.openai.chatgpt.site/#projects

### 3. Dot gadgets: DM cockpit status beacon

- **Игровой сценарий:** отдельный маленький экран показывает `READY`, `BUSY`,
  `ALERT`, `PLAYER TURN` или `SESSION PAUSED`; DM не открывает вкладку, чтобы
  понять, ждёт ли партия действия.
- **Компоненты из карточки:** LilyGo T-Display S3 и USB-C; firmware на
  CircuitPython, MCP relay на Cloudflare Worker + Durable Object, passkey/OAuth.
- **Исходники/инструкция:** карточка содержит подробные setup steps и source link:
  https://github.com/deadbeef101010/dot-gadget . Лицензию репозитория нужно
  проверить перед любым reuse; карточка сама её не подтверждает.
- **Сложность:** medium: простой UI, pairing, relay, auth и offline state.
- **Приватность:** relay получает состояние агента и control permissions; нельзя
  отправлять campaign text, private notes или player PII. Passkey/OAuth и
  per-device revocation обязательны.
- **Лицензирование:** не копировать relay, CircuitPython code, icons или text;
  использовать только идею статусов после отдельной license review.
- **VTT-замена:** второй локальный browser viewport или floating DM status strip;
  состояние берётся из server event log и не раскрывает player-safe secrets.
- **Источник:** https://youcanjustbuildthings.openai.chatgpt.site/#projects

### 4. ProjectTabletop: физическая shared scene

- **Игровой сценарий:** проектор показывает shared scene, webcam видит руки или
  простые маркеры; игрок двигает физический token, а DM меняет сцену и fog/spotlight.
- **Компоненты из карточки:** Windows 11 x64 PC, projector, webcam, matte board,
  printed markers, GPU; C# WinUI 3, Win2D, OpenCvSharp.
- **Исходники/инструкция:** полноценный source/build/test guide:
  https://github.com/abiemann/ProjectTabletop .
- **Сложность:** very high: projector calibration, camera CV, GPU buffers,
  physical lighting и hardware-specific acceptance.
- **Приватность:** webcam frames и hand tracking; безопаснее держать всё local-only,
  не писать видео и не отправлять camera frames в облако.
- **Лицензирование:** README прямо указывает custom **ProjectTabletop
  Noncommercial License 1.0**; commercial use требует отдельного письменного
  разрешения. Поэтому это UX reference, не reusable implementation.
- **VTT-замена:** существующий shared scene/map canvas с pointer/touch markers,
  fog-of-war и server-owned scene events; сначала без CV и проектора.
- **Источник:** https://github.com/abiemann/ProjectTabletop

### 5. Official Realtime on ESP32: голосовой physical DM bridge

- **Игровой сценарий:** игрок нажимает кнопку и говорит короткую реплику; устройство
  отвечает голосом как выбранный in-world narrator, а на экране/свете показывает
  `listening`, `thinking`, `speaking`.
- **Компоненты из карточки:** ESP32-S3-Korvo-2, speaker, два USB-A↔Micro-B
  кабеля, Wi-Fi и компьютер для flash; ESP-IDF + Espressif `openai_demo`.
- **Исходники/инструкция:** официальный указатель OpenAI:
  https://github.com/openai/openai-realtime-embedded (MIT); поддерживаемый demo:
  https://github.com/espressif/esp-webrtc-solution/tree/main/solutions/openai_demo .
  README описывает ephemeral client secret, WebRTC/Realtime calls, build и flash.
- **Сложность:** high: ESP-IDF, board manager, WebRTC audio, token relay,
  Wi-Fi recovery и provider cost.
- **Приватность:** audio и API session; ключ нельзя прошивать в firmware. Нужен
  BFF-issued short-lived token, явный recording indicator и session opt-in.
- **Лицензирование:** OpenAI repo MIT, но Espressif components, board assets и
  дополнительные зависимости проверяются отдельно; MIT не разрешает чужие
  campaign names/characters/assets.
- **VTT-замена:** browser push-to-talk + локальная speech synthesis или обычный
  текстовый narrator; backend сохраняет только approved transcript/event.
- **Источники:** https://github.com/openai/openai-realtime-embedded и
  https://github.com/espressif/esp-webrtc-solution/tree/main/solutions/openai_demo

## Рекомендованный первый прототип без покупок

### Local Prop Mode

Сделать только исследовательскую UX-модель в существующем VTT, без изменения
репозитория на этом этапе:

1. Открыть второй локальный browser viewport рядом с DM cockpit.
2. Показывать крупное состояние партии: `READY`, `LISTENING`, `THINKING`,
   `DANGER`, `PLAYER TURN`, `SESSION RECAP`.
3. Брать переходы только из Campaign event log: scene update, action, initiative,
   reconnect и recap.
4. Для голоса использовать только opt-in browser SpeechSynthesis; микрофон по
   умолчанию выключен. Для звука — короткие Web Audio tones, без скачанных ассетов.
5. Не хранить raw audio, не отправлять campaign text в сторонний relay, не
   публиковать screenshot/video и не включать реальные лица.

**Критерий:** два browser viewport видят одинаковое состояние, player-safe
projection не раскрывает GM notes, reconnect восстанавливает статус, а вся модель
работает без железа и внешнего аккаунта. После этого можно решать, нужен ли Dot-like
display или voice device.

## Порядок следующей проверки

1. Утвердить один fictional familiar и набор оригинальных status sounds/visuals.
2. Проверить Local Prop Mode на existing Campaign API и mobile layout.
3. Если UX полезен, выбрать hardware track: Dot-like status display (самый узкий)
   или Realtime ESP32 (голосовой, но дорогой по security/ops).
4. Перед любым железом проверить BOM, electrical safety, firmware dependencies,
   license notices, provider costs и retention policy.
5. Не переносить community code, pixel art, prompts, voices, names или screenshots
   в Forge без отдельного written permission/license review.

## Sources and provenance

- Catalog: https://youcanjustbuildthings.openai.chatgpt.site/
- Catalog search results were read-only and approved/community or official entries;
  approval in the catalog is not a license grant.
- ProjectTabletop license restriction was verified in its README.
- OpenAI Realtime Embedded and OpenAI Reflect repositories expose MIT license labels;
  Reflect README also marks the project as a demo/hackathon project provided as-is.
- No purchase, sign-in, upload, publication, repository clone or code change was
  performed for this brief.
