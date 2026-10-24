# Content and brand release policy

Статус: `BLOCKED_FOR_PUBLIC_COMMERCIAL_USE`.

Этот документ фиксирует инженерные правила. Он не является юридическим
заключением и не заменяет проверку юристом.

## Что можно выпускать

- Оригинальный текст, код и иллюстрации с сохранённой provenance-записью.
- Материал с лицензией, которая прямо покрывает нужную аудиторию,
  территорию, способ использования и производные работы.
- SRD 5.1 только с точной CC BY 4.0 attribution и без вывода, что лицензия
  распространяется на чужие setting/brand elements.

## Что нельзя считать очищенным

- Названия и сюжетные элементы известных settings, персонажей, богов,
  factions и adventures.
- `D&D`/`DnD`-adjacent brand usage до письменной trademark review.
- Asset только потому, что он сгенерирован, найден по ссылке или оформлен
  «похожим, но не таким».
- Прежний build или старый status-файл как доказательство текущей clearance.

## Обязательные gates

Перед `public beta`, billing, marketplace или paid distribution должны быть
закрыты все пункты:

1. clean-room scan не находит protected setting/story names в shipping source,
   assets и build;
2. у каждого shipped asset есть provenance и допустимый rights state;
3. `THIRD_PARTY_NOTICES.md` и dependency license inventory обновлены;
4. бренд получил письменное clearance или продукт переименован после
   профессиональной проверки;
5. production dependency audit не содержит открытых High/Critical advisory;
6. owner провёл human review границ SRD/CC-BY и исключённых материалов.

Локальная команда для этого стоп-крана: `npm run qa:content-boundary`. Она
проверяет source, public assets и собранный `build`. На текущем checkout она
ожидаемо завершается с ошибкой и перечисляет 78 находок; это означает, что
clean-room rewrite ещё не принят.

Текущий checkout этим условиям не соответствует: в source остаются примеры
Phandalin/Barovia/Strahd и другие protected names, `Eclipse DnD Forge` имеет
только предварительный screen со статусом `NOT CLEARED`, а `npm audit
--omit=dev` показывает 5 High и 2 Moderate.

## Действия для clean-room pass

- заменить narrative starters и prompt examples на оригинальные названия и
  мир без сохранения узнаваемых сюжетных связей;
- оставить правила отдельно от setting content и сохранить точную attribution;
- удалить или quarantine-нуть неразрешённые public assets и проверить
  generated build;
- добавить regression guard, который блокирует возврат protected names;
- провести отдельный trademark search и сохранить письменное решение.
