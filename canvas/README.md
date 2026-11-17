# /canvas — цифровой буклет «Ожившие шедевры»

Страница открывается по QR-коду из печатного буклета:
`https://xn--80aanbjgaodo1bgudcs1l.xn--p1ai/canvas?utm_source=booklet` (QR — `public/qr-canvas.svg`,
на сайте `/assets/canvas/qr-canvas.svg`). В меню и в sitemap её нет, `noindex`.

## Где что

| Что | Файл |
|---|---|
| Тексты, порядок, рамки, фоны | `data/paintings.json` |
| HTML страницы (работает без JS) | `page.php` — подключается из `api/seo/index.php` |
| 3D (three.js) | `src/scene.ts` |
| Жесты, тексты, зум, запасной режим | `src/main.ts` |
| Стили | `src/canvas.css` |
| Рамы (модели Blender) | `blender/frames.py` → `public/frames/*.glb`, материалы — `src/frames.ts` |
| Картины, фоны, шрифт, логотип, OG | `public/` → на сайте `/assets/canvas/` |

## Как поправить текст
Изменить абзац в `data/paintings.json` (поле `text`), затем собрать пакет как обычно.
Картинки пересобирать не нужно.

## Как добавить или заменить картину
1. Добавить запись в `paintings` (`slug`, `number`, `title`, `artist`, `year`, `frame`: стиль из таблицы `frames` или `none`,
   `image`: `NN-slug`, `source`: `{"commons": "<имя файла на Wikimedia Commons>"}` или `{"url": "<прямая ссылка>"}`,
   `text`: абзацы). `aspect` и `placeholder` можно оставить `null`.
2. `npm run media -w canvas` — скачает исходник в `.cache/`, сделает WebP 1024/2048, заглушку и пропорции.
3. `npm run frames -w canvas -- <slug>` — рама в Blender.
4. `npm run build -w canvas`.

## Рамы
Стиль рамы — поле `frame` у картины, ширина и тон — таблица `frames`. Модели строит Blender 4.5
(`.local-tools/blender/Blender.app` или переменная `BLENDER`): `npm run frames -w canvas`
(`-- --preview <папка>` — превью-рендеры, можно перечислить slug'и). Золото и чёрный лак — matcap-рендеры
настоящих материалов, дерево — текстуры Poly Haven (CC0), затенение запечено в вершины.
Фон раздела — размытая копия его картины (`public/backgrounds/`, делает `npm run media -w canvas`).

## Проверка
- `?no3d=1` — без WebGL: обычные картинки с CSS-наклоном.
- Без JS — все тексты раскрыты.
- Цели Метрики: `canvas_open_text` (параметр `painting` = slug), `buy_click` на «Купить билет».
