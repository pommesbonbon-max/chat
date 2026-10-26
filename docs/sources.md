# Источники, происхождение и атрибуция

## Поставляемые компоненты

| Компонент | Источник | Состав |
| --- | --- | --- |
| Leaflet 1.9.4 | <https://leafletjs.com/> | Локальная библиотека в `assets/vendor/leaflet/`; текст `LICENSE` хранится рядом с файлами библиотеки |
| Atlas GTA V | [Flamm64/GTA-V-World-Map](https://github.com/Flamm64/GTA-V-World-Map) | Уровни `0–5`, 1365 JPG-тайлов `256 × 256` |
| Коэффициенты геопривязки | [oyuh/w3w-map/src/lib/w3w.ts](https://github.com/oyuh/w3w-map/blob/master/src/lib/w3w.ts) | Числовая общественная калибровка того же тайлового набора |
| Диагностическая сетка | Код приложения | Дополнительный режим проверки проекции |
| Satellite и Roadmap | Присутствуют в исходном картографическом проекте | В текущую поставку не включены; подключение относится к этапу 4 |

## Atlas: зафиксированный источник

- Репозиторий: <https://github.com/Flamm64/GTA-V-World-Map>.
- Коммит: `2f2f85a680e650fd4e141abfdda1e8df7158eb13` от 2 мая 2015 года.
- Архив: [Atlas/Atlas.7z](https://raw.githubusercontent.com/Flamm64/GTA-V-World-Map/2f2f85a680e650fd4e141abfdda1e8df7158eb13/Atlas/Atlas.7z).
- SHA-256 архива: `6f1492f08494f4e6036ed9d47cf93e45d26180ab24486cc39329b8dd503571e5`.
- Проверка и подготовка поставки: 26 октября 2026 года.
- Автор карты согласно исходному notice: Zslash / Martin Floden.

Архив содержит квадратную пирамиду XYZ `0–7` с именами `{z}_{x}_{y}.jpg`. Для этапа 3 выбраны все тайлы уровней `0–5`; имена организованы как `assets/tiles/atlas/{z}/{x}/{y}.jpg`. Изображения не перекодировались. Поднабор занимает `21 069 637` байт, без учёта документации. Исходный Google Maps viewer заменён собственным приложением Leaflet.

Ниже дословно сохранён исходный `License.txt`. Это собственный текст автора; он не обозначается как MIT, Creative Commons или другая стандартная лицензия:

```text
GTA V World Map created by Zslash aKa Martin Floden - http://www.lifeinsanandreas.com
All maps rendered in 20K res using https://github.com/bramus/photoshop-google-maps-tile-cutter/

Please don't re-publish as is. However you can share, modify and use this any way you want!
Give credits if you feel like it :P Altho not required to!
```

В исходном README также указано: “Please don't republish/upload as is.” и “You can edit, modify, share and republish as long as you modify it.” Полный README доступен в [зафиксированной версии](https://github.com/Flamm64/GTA-V-World-Map/blob/2f2f85a680e650fd4e141abfdda1e8df7158eb13/README.md).

В интерфейсе сохраняется атрибуция источника Atlas и упоминание Rockstar Games как владельца GTA V. Публикация сайта и изменения GitHub не выполняются на этапе локальной разработки.

## Геопривязка

[README oyuh/w3w-map](https://github.com/oyuh/w3w-map/blob/master/README.md) указывает Flamm64 как источник тайлов. Его преобразование рассчитано для полотна `32768 × 32768` на уровне `7`. Для поставляемого уровня `5` все пиксельные коэффициенты разделены на четыре; вывод приведён в [projection.md](projection.md).

Это числовая общественная калибровка, а не подтверждённая исходными метаданными Rockstar геопривязка. Код и картографические изображения проекта oyuh/w3w-map в приложение не копируются. Независимая оценка погрешности соответствия игровых и пиксельных координат пока не выполнена.

## Хранение и последующие слои

Большие исходные растры и архивы не нужны браузеру и не входят в поставку. Готовые тайлы могут храниться в `assets/tiles/{layer}/{z}/{x}/{y}.jpg` или на отдельном статическом хостинге/CDN. Для внешних тайлов следует проверить доступ из браузера и настройки CORS, если приложение читает пиксели через Canvas.

При добавлении Satellite или Roadmap фиксируются точный источник, версия, условия использования, атрибуция, состав пирамиды и результаты проверки геопривязки. До этого такие стили не предлагаются пользователю как доступные.
