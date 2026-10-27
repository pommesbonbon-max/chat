# Источники, происхождение и атрибуция

## Поставляемые компоненты

| Компонент | Источник | Состав |
| --- | --- | --- |
| Leaflet 1.9.4 | <https://leafletjs.com/> | Локальная библиотека в `assets/vendor/leaflet/`; текст `LICENSE` хранится рядом с файлами библиотеки |
| Atlas / Satellite / Roadmap | [Flamm64/GTA-V-World-Map](https://github.com/Flamm64/GTA-V-World-Map) | По 1365 JPG-тайлов `256 × 256`, уровни `0–5`; всего 4095 файлов |
| Коэффициенты геопривязки | [oyuh/w3w-map/src/lib/w3w.ts](https://github.com/oyuh/w3w-map/blob/master/src/lib/w3w.ts) | Числовая общественная калибровка того же тайлового набора |
| Каталог известных мест | [data/places.json](../data/places.json) | 34 выбранные точки из открытых конфигураций FiveM; точный источник указан у каждой записи |
| Диагностическая сетка | Код приложения | Дополнительный режим проверки проекции |

## Подложки: зафиксированный источник

- Репозиторий: <https://github.com/Flamm64/GTA-V-World-Map>.
- Коммит: `2f2f85a680e650fd4e141abfdda1e8df7158eb13` от 2 мая 2015 года.
- Atlas проверен и подготовлен 26 октября 2026 года; Satellite и Roadmap добавлены на этапе 4.
- Автор карты согласно исходному notice: Zslash / Martin Floden.

| Слой | Исходный архив | SHA-256 архива | Размер поставляемых тайлов, байт |
| --- | --- | --- | ---: |
| Atlas | [Atlas/Atlas.7z](https://raw.githubusercontent.com/Flamm64/GTA-V-World-Map/2f2f85a680e650fd4e141abfdda1e8df7158eb13/Atlas/Atlas.7z) | `6f1492f08494f4e6036ed9d47cf93e45d26180ab24486cc39329b8dd503571e5` | 21 069 637 |
| Satellite | [Satellite/Satellite.7z](https://raw.githubusercontent.com/Flamm64/GTA-V-World-Map/2f2f85a680e650fd4e141abfdda1e8df7158eb13/Satellite/Satellite.7z) | `2f70afff280918f0de3e45ca382a4813d1ad4cc5e320c91e2d7cba6e11632683` | 25 646 220 |
| Roadmap | [Roadmap/Roadmap.7z](https://raw.githubusercontent.com/Flamm64/GTA-V-World-Map/2f2f85a680e650fd4e141abfdda1e8df7158eb13/Roadmap/Roadmap.7z) | `d6c0501790860eeea10745604be4d48256d2cc2c899b6aa624d58085beab8114` | 22 043 968 |

Для каждого стиля выбраны все тайлы XYZ уровней `0–5`; исходные имена `{z}_{x}_{y}.jpg` организованы как `assets/tiles/{atlas|satellite|roadmap}/{z}/{x}/{y}.jpg`. Размер каждого изображения проверен: `256 × 256`. Файлы скопированы без перекодирования, изменения размеров или цветов. Итого `68 759 825` байт картографических изображений, без учёта документации. Исходный Google Maps viewer заменён собственным приложением Leaflet.

Ниже дословно сохранён исходный `License.txt`. Это собственный текст автора; он не обозначается как MIT, Creative Commons или другая стандартная лицензия:

```text
GTA V World Map created by Zslash aKa Martin Floden - http://www.lifeinsanandreas.com
All maps rendered in 20K res using https://github.com/bramus/photoshop-google-maps-tile-cutter/

Please don't re-publish as is. However you can share, modify and use this any way you want!
Give credits if you feel like it :P Altho not required to!
```

В исходном README также указано: “Please don't republish/upload as is.” и “You can edit, modify, share and republish as long as you modify it.” Полный README доступен в [зафиксированной версии](https://github.com/Flamm64/GTA-V-World-Map/blob/2f2f85a680e650fd4e141abfdda1e8df7158eb13/README.md).

Отдельная копия notice сохранена в [assets/tiles/Flamm64-License.txt](../assets/tiles/Flamm64-License.txt). В интерфейсе сохраняется атрибуция источника карт и упоминание Rockstar Games как владельца GTA V.

## Геопривязка

[README oyuh/w3w-map](https://github.com/oyuh/w3w-map/blob/master/README.md) указывает Flamm64 как источник тайлов. Его преобразование рассчитано для полотна `32768 × 32768` на уровне `7`. Для поставляемого уровня `5` все пиксельные коэффициенты разделены на четыре; вывод приведён в [projection.md](projection.md).

Это числовая общественная калибровка, а не подтверждённая исходными метаданными Rockstar геопривязка. Код и картографические изображения проекта oyuh/w3w-map в приложение не копируются. Независимая оценка погрешности соответствия игровых и пиксельных координат пока не выполнена.

Три стиля используют общую сетку XYZ и одну систему координат. Визуальная проверка совпадения побережья, Alamo Sea, аэродрома, улиц Vinewood и городских развязок выполнена на одинаковых индексах тайлов. Она подтверждает согласованность подложек, но не измеряет ошибку относительно игровых координат и не доказывает точность 1:1.

## Каталог известных мест

В `data/places.json` включены 34 точки: 12 объектов категории `service`, 14 `transport`, 6 `landmark` и 2 `nature`. Названия, русские и английские поисковые варианты подобраны для этого приложения. Числовые X/Y взяты без округления из следующих зафиксированных конфигураций:

| Источник конфигурации | Число точек | Лицензия исходного репозитория |
| --- | ---: | --- |
| [qbcore-fivem/qb-policejob · 1dd32289a99f85b144d69cf7154139909027789e](https://github.com/qbcore-fivem/qb-policejob/blob/1dd32289a99f85b144d69cf7154139909027789e/config.lua) | 3 | [GNU GPL v3](https://github.com/qbcore-fivem/qb-policejob/blob/1dd32289a99f85b144d69cf7154139909027789e/LICENSE) |
| [qbcore-fivem/qb-ambulancejob · 19bb190d7c41e6b79d836a45d7498bd3762d0bd4](https://github.com/qbcore-fivem/qb-ambulancejob/blob/19bb190d7c41e6b79d836a45d7498bd3762d0bd4/config.lua) | 2 | [GNU GPL v3](https://github.com/qbcore-fivem/qb-ambulancejob/blob/19bb190d7c41e6b79d836a45d7498bd3762d0bd4/LICENSE) |
| [qbcore-fivem/qb-garages · 29a277965fc3d01904bb7ade91324f3d63b51c04](https://github.com/qbcore-fivem/qb-garages/blob/29a277965fc3d01904bb7ade91324f3d63b51c04/config.lua) | 15 | [GNU GPL v3](https://github.com/qbcore-fivem/qb-garages/blob/29a277965fc3d01904bb7ade91324f3d63b51c04/LICENSE) |
| [qbcore-fivem/qb-shops · 4c4082efd9d582355e6b564e95dd3bb1d10e0961](https://github.com/qbcore-fivem/qb-shops/blob/4c4082efd9d582355e6b564e95dd3bb1d10e0961/config.lua) | 8 | [GNU GPL v3](https://github.com/qbcore-fivem/qb-shops/blob/4c4082efd9d582355e6b564e95dd3bb1d10e0961/LICENSE) |
| [Giana/g-bikerentals · 35104e5906c85fe8dd4f8efabb9a6da623c542d3](https://github.com/Giana/g-bikerentals/blob/35104e5906c85fe8dd4f8efabb9a6da623c542d3/config.lua) | 6 | [GNU GPL v3](https://github.com/Giana/g-bikerentals/blob/35104e5906c85fe8dd4f8efabb9a6da623c542d3/LICENSE) |

У каждой записи `source` содержит ссылку на точную строку и полный коммит. Перенесены координатные факты и ссылки; Lua-функции исходных проектов не копировались. QBCore-ссылки используют актуального владельца `qbcore-fivem`.

Это координаты общественных конфигураций FiveM, а не официальный геодезический каталог Rockstar. Точки обозначают указанную станцию, вход, парковку или место взаимодействия; они не являются вычисленными центрами объектов. Шесть «велоточек» взяты из мест взаимодействия `g-bikerentals`: подпись не означает, что прокат существует в оригинальной GTA V, а точка у горы Чилиад не объявляется точной вершиной. Высота и направление взгляда для плоской карты опущены.

## Хранение

Большие исходные растры и архивы не нужны браузеру и не входят в поставку. Готовые тайлы могут храниться в `assets/tiles/{layer}/{z}/{x}/{y}.jpg` или на отдельном статическом хостинге/CDN. Для внешних тайлов следует проверить доступ из браузера и настройки CORS, если приложение читает пиксели через Canvas.

Приложение работает как статический сайт. Пользовательские метки сохраняются в `localStorage` текущего браузера для текущего адреса сайта; серверного хранения и синхронизации между устройствами нет.
