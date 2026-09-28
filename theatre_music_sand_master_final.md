# Театр Музыки и Песка — FINAL MASTER SPEC

**Статус:** финальная согласованная спецификация перед разработкой.  
**Приоритет:** этот файл — единый source of truth. При противоречии со старыми MD/обсуждениями использовать этот файл.

---

# 1. Главные правила

- Public-сайт: кинематографичный, editorial, premium minimalism, много воздуха, крупные фото/video/типографика.
- **Плавность и бесшовные переходы между страницами — одна из главных задач проекта.**
- Не добавлять неутверждённые функции, сущности, поля, секции, демо-контент и UI-паттерны.
- Liquid Glass — только desktop-admin, никогда public.
- Владелец отдельно передаст Codex фото главной, логотипы, фото музыкантов/партнёров и другие assets с пометками, что и где использовать. Не генерировать/подменять их.
- **Репертуар и Афишу не заполнять демо-данными.** После готовности владелец заполнит их через admin.
- FAQ создать с утверждёнными текстами ниже.
- Утверждённый copy не переписывать.

---

# 2. Stack / production

## Public
- Vite + React + TypeScript
- React Router
- GSAP + ScrollTrigger для сложной motion
- CSS transitions для micro-interactions
- HTML5 video для Hero

## Backend
- PHP 8.x
- lightweight custom REST API
- MySQL
- PDO prepared statements
- JSON

## Desktop Admin
- Tauri + React + TypeScript
- desktop-only, отдельная устанавливаемая программа

## Production
- shared hosting REG.RU
- Apache + PHP + MySQL + static Vite assets + uploads
- без production Node.js / Next.js / Docker / обязательного VPS/VDS
- Node/Rust только local/build-time

Repository:
```text
theatre-music-sand/
├── web/
├── admin/
├── api/
├── database/
├── docs/
└── README.md
```

Локальный Git обязателен. GitHub пока не используется. Секреты не коммитить.

---

# 3. Public design system

## Цвета
- dark `#080808`
- pure black `#000000` только Intro/deep overlays
- warm white `#F7F6F3`
- light text `#F5F4F1`
- dark text `#111111`
- без отдельной gold/red/beige accent-system

## Шрифты
**Cormorant Garamond** — весь основной public UI/content. Display Light/300, body Regular/400.

**Kosolapa Script** — только:
1. Hero-фраза главной;
2. главная фраза «О театре».

Нигде больше Kosolapa не использовать.

Fluid sizing через `clamp()`; ориентиры:
- Hero Kosolapa desktop ~72–110px / mobile ~44–64px
- About phrase ~64–96px desktop
- fullscreen menu ~64–88px desktop
- performance title ~56–80px
- Afisha date ~32–44px
- body ~20–24px desktop / ~18–20px mobile

## Layout
- не rigid corporate 12-col grid
- desktop side fields ~5–7vw
- tablet ~32–48px
- mobile ~20–24px
- major vertical spacing ~120–200px desktop / ~72–120px mobile
- controlled editorial asymmetry allowed

## Motion
Общий reveal: blur ~10–16px + opacity → sharp; optional subtle settling ~20–35px.
- normal ~0.8–1.2s
- large scene ~1.4–1.6s
- micro ~200–350ms
- no bounce/spring/harsh easing
- `prefers-reduced-motion` → calm fades

Не использовать public: generic cards, pills, glass, glow, сильные shadows, выраженные radii.

---

# 4. Главная

## Intro
Показывается один раз за user session.
- 0.0–0.4s black
- 0.4–1.4 logo centered: blur→sharp + opacity + optional 96→100%
- 1.4–2.0 pause
- 2.0–3.0 Hero video появляется за logo
- затем slogan
- hamburger последним

Через sessionStorage/equivalent. Internal navigation/reload same tab/return home не повторяют Intro. Без loader/progress/percentage.

## Hero
- `100dvh`, fullscreen
- atmospheric montage из нескольких performance fragments
- autoplay, no audio, seamless loop, `cover`
- poster image до video
- мягкий dark overlay
- mobile-adapted crop; отдельный mobile video допустим, если передан владельцем
- Hero содержит только video + logo + slogan + hamburger

Точный slogan:
> **Волшебство начинается - здесь**

Шрифт: Kosolapa Script.

## Fullscreen navigation
Fullscreen overlay, не sidebar.
Menu:
- Репертуар
- Афиша
- FAQ
- Франшиза

Background: atmospheric theatre photo + dark overlay. Close X top-left, logo top-center, socials desktop top-right. Cormorant large vertical menu. Hover/current brighter, остальные dim; background не меняется.

Accessibility:
- Esc closes
- Tab focus trap
- background scroll lock
- focus back to hamburger
- exact page/scroll state preserved

Opening: dark layer → background photo → logo → items → socials. Closing reverse.

## «О театре»
Warm-white editorial/asymmetric section.

Exact phrase:
> **Театр Музыки и Песка — где сказка становится кино, а кино — живым**

Kosolapa Script.

Exact supporting copy:
> Театр Музыки и Песка — это не просто детский спектакль. Это современное перформанс-искусство, где музыка, слово и визуальная поэзия сливаются в единый поток эмоций.
>
> Это не просто шоу — это ритуал, медитация, вызов гравитации и времени.

Обязательная композиция: phrase top/left + большая performance photo справа/со смещением + supporting text в white space + финальная фраза с большим воздухом.

Обязательная анимация:
1. Kosolapa-фраза мягко «выпрыгивает»: slight scale + opacity + subtle settling, no bounce;
2. pause;
3. фото уже в final position, без slide;
4. фото проявляется из «белого тумана»: washed/light blur → sharp;
5. supporting text.

Mobile сохраняет ту же text+photo драматургию.

## Директор и музыканты
- black section
- большие vertical monochrome portraits в infinite horizontal strip
- prepared images уже содержат name+quote: не рендерить их отдельно и не модифицировать assets
- desktop: very slow auto; hover → pause; leave → resume
- mobile: auto + swipe both ways; touch pause; idle resume; one card + часть next
- no dots/arrows/scrollbar

## Partners
- exactly 4
- warm-white
- label «Партнёры театра»
- monochrome black logos
- desktop one row; mobile 2×2
- no cards/frames/shadows
- sequential blur→fade→sharp
- no marquee
- clickable official site in new tab if URL supplied

## Footer
Black, large, clean.
Contacts:
- Нижний Новгород
- 8 (831) 423-58-04
- +7 929 053-58-04
- info@teatrmip-nn.ru

Use `tel:` / `mailto:`.

Legal:
- © All Right Reserved. Театр Музыки и Песка.
- ИП Доброхотова Н.М. ИНН 525715626730
- ОГРН 316527500079224

Desktop: large white logo → contacts/city/socials → thin line → legal. Mobile vertical. Calm blur/fade reveal. No decorative ending.

Main rhythm: dark Hero → warm-white About → dark Musicians → warm-white Partners → dark Footer.

---

# 5. Репертуар

Routes:
- `/repertoire`
- `/repertoire/:slug`

**Не seed/demo-fill.**

Each performance scene ~90–100dvh.
Foreground: sharp vertical `cover_image` + title + optional exact line `Премьера` if `is_premiere=true` + short description.

Background = same `cover_image`, fullscreen `cover`, blur ~30–50px, scale ~105–110%, adaptive dark overlay. Light text always. No `background_image`.

GSAP/ScrollTrigger tied to natural scroll: current fades/loses focus, next emerges from blur, backgrounds crossfade. No scroll-jacking/snap. Cover clickable → performance page. No buy button.

Manual order via admin drag/drop.

---

# 6. Individual performance

- top wide `hero_image`, atmospheric frame, not cover and not blurred cover copy
- below warm-white content
- vertical `cover_image` centered across boundary: ~1/3 over Hero, ~2/3 on white
- title + optional exact `Премьера`
- full description below, editorial line length / lots of air

No gallery/trailer/characteristics/CTA/buy.

Reveal: hero → cover manifests from light fog/blur in final position → text.

Mobile: same composition; hero `cover`; cover ~55–65vw; body ~18–20px; side 20–24px; lighter blur.

`hero_image` has separate desktop/mobile focal points.

---

# 7. Афиша

Route `/afisha`.
**Не seed/demo-fill.**

Each event = separate large scene.
Order:
**Дата → постер → название спектакля → optional «Премьера» → место → Купить билет**

**Времени нет.**

Foreground poster sharp. Background = same `poster_image` enlarged/cover/strong blur + adaptive dark overlay. No separate background image.

Buy link:
- Cormorant typographic link + thin underline
- exact external `ticket_url`
- new tab
- tracking non-blocking
- analytics failure never blocks navigation

Upcoming nearest-first. Past hidden public, muted in admin.

Empty exact text:
> **Новые даты скоро появятся**

---

# 8. FAQ

Route `/faq`. Warm-white minimalist accordion. No extra CTA/cards/decor.
- thin separators
- one item open at a time
- `+` → `−`
- answer smooth height + light blur
- sequential initial reveal
- mobile question ~24–30px; answer ~18–20px
- dynamic MySQL/admin, drag/drop

Seed exactly these 5:

### 1. Сколько длится спектакль?
Все спектакли Театра Музыки и Песка длятся **50–60 минут без антракта**. Такой формат помогает сохранить целостность истории и удерживать внимание зрителей на протяжении всего представления.

Спектакли подходят **для семей с детьми от 3 лет, школьных групп и организованных культурных мероприятий**.

### 2. Подойдёт ли спектакль моему ребёнку?
Все дети воспринимают театр по-разному. Наш формат объединяет **живую музыку, литературу и песочную анимацию**, поэтому каждый ребёнок может найти в спектакле что-то своё.

Перед посещением рекомендуем познакомиться с описанием выбранного спектакля. Если останутся вопросы — **позвоните нам, и мы поможем с выбором**.

### 3. Нужен ли отдельный билет маленькому ребёнку?
Если ребёнок может сидеть у вас на коленях и **не занимает отдельного места**, достаточно одного билета на двоих.

Принцип простой: **одно отдельное место — один билет**.

### 4. Где проходят спектакли?
Наша основная площадка — **арт-клуб «Маяковка 10»** по адресу: **Нижний Новгород, ул. Рождественская, 10, 4 этаж**.

Зал рассчитан на **82 зрителя**. Начиная с третьего ряда места расположены на подъёме, поэтому сцену хорошо видно из разных частей зала.

Также Театр Музыки и Песка может проводить **выездные спектакли на вашей площадке**. По вопросам организации свяжитесь с нами по телефону.

### 5. Как вернуть билет?
Если билет приобретён через **QTickets**, информация о возврате находится в письме с электронными билетами — в разделе **«Как вернуть электронный билет»**. Там указаны контакты и доступные способы оформления возврата.

При обращении подготовьте **номер заказа, название мероприятия, билеты для возврата и email, указанный при покупке**.

Условия возврата зависят от срока до мероприятия: **более 10 дней — без удержания; 5–10 дней — удержание 50%; 3–5 дней — 70%; менее 3 дней — возврат не предусмотрен**. Для акционных билетов и особых случаев действуют отдельные условия.

---

# 9. Франшиза

Route `/franchise`.

## Scene 1 — Hero
`100dvh`, atmospheric performance photo, not video, dark overlay.

Exact text:
> **Откройте Театр Музыки и Песка  
> в своём городе**
>
> Театр, где живая музыка, художественное слово и песочная анимация соединяются в единое представление.
>
> Мы передаём партнёру готовые спектакли, все необходимые материалы и сопровождаем запуск — чтобы Театр Музыки и Песка мог начать свою историю в новом городе.

Cormorant Garamond Light, no Kosolapa, no CTA. Photo blur→sharp → headline → texts. No parallax/zoom.

## Scene 2
Warm-white, no photo.
Heading:
> **Всё необходимое для запуска театра**

01 — Готовый репертуар  
Спектакли, сценарии, партитуры и песочная анимация.

02 — Подготовка команды  
Помощь с подбором артистов, репетициями и подготовкой к премьере.

03 — Продвижение и продажи  
Готовые материалы и инструменты для работы со зрителями, школами и культурными площадками.

04 — Сопровождение  
Помощь с техническими и организационными вопросами не только во время запуска, но и после него.

Desktop editorial 2×2 без карточек; mobile vertical; reveal 01→04.

## Scene 3
Warm-white, no photo.
> **Театр там,  
> где есть зритель**

> Спектакли не требуют собственной стационарной сцены. Театр может работать в школах, домах культуры, библиотеках и на других подходящих площадках.
>
> Минимум сложных декораций и мобильный формат позволяют работать в разных пространствах и расширять географию показов.

Large typographic pause, controlled asymmetry. No icons/maps/schemes.

## Scene 4 — Economy
Dark `#080808`, no photo.
> **Экономика, которую можно посчитать**

- **от 150 000 ₽** — стартовый пакет
- **0 ₽** — роялти первые 4 месяца
- **6–9 месяцев** — ориентировочный срок окупаемости

Disclaimer exact:
> После первых четырёх месяцев роялти составляет 10 000 ₽ в месяц. Финансовые показатели основаны на опыте головной площадки в Нижегородской области и могут отличаться в зависимости от региона, количества показов и работы партнёра.

Desktop: 3 huge numbers horizontal; mobile vertical. Blur→sharp, not counters. Не выводить 400–600k revenue / 260–390k profit как central claim.

## Scene 5 — Path
Warm-white, no photo.
> **От решения  
> до первого спектакля**

01 — Договор  
Начинаем работу и передаём необходимые материалы.

02 — Команда  
Помогаем сформировать состав и подобрать исполнителей.

03 — Репетиции  
Сопровождаем подготовку спектакля и техническую настройку.

04 — Премьера  
Помогаем подготовиться к первым показам и запуску продаж.

05 — Развитие  
Остаёмся на связи после запуска и сопровождаем дальнейшую работу театра.

Vertical path with one thin line; line reveals down page; stages appear on reach. No cards.

## Final application scene
Dark atmospheric performance photo.

> **Создайте Театр Музыки и Песка  
> в своём городе**
>
> Расскажите нам о себе и городе, в котором вы хотите открыть театр. Мы свяжемся с вами и обсудим возможности запуска.

Fields: Имя / Город / Телефон.  
CTA: **Обсудить франшизу**

Success exact:
> **Спасибо. Ваша заявка отправлена.**  
> Мы свяжемся с вами в ближайшее время.

No white card/glass. Transparent inputs + thin underline. Desktop text-left/form-right; mobile one column. Save to DB/admin only, **no email**.

Page rhythm: dark photo Hero → light benefits → light typographic mobility → dark economy → light path → dark photo form.

---

# 10. Route transitions / smoothness

Site should feel like one continuous theatre space.
General: current scene soft blur/fade → next page appears blurred → sharp. Typical route transition ~0.6–0.9s.

- Intro never repeats internally.
- Menu → target scene continuous.
- Repertoire → performance: preserve cover as visual anchor if feasible.
- Back to repertoire restores exact scroll/performance position.
- Rapid route requests: do not queue animations; cancel/complete safely and honor latest route.
- No scroll-jacking.
- Mobile effects lighter.
- Smoothness has priority over decorative complexity.

---

# 11. Desktop Admin

Separate Tauri app, not `/admin` web page.
Visual: iPhone-inspired Liquid Glass, not fake macOS. Light/silver background, permanent glass sidebar, workspace right, high readability.

Sidebar:
- logo
- Статистика
- Афиша
- Репертуар
- FAQ
- Франшиза
- Выйти

One shared admin account. No roles/registration/invites/forgot/user management/OAuth/2FA.

Auth endpoints:
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

`password_hash/password_verify`; cryptographically random token; DB stores only hash; max token life 30 days; Tauri raw token in secure OS-backed storage; logout revokes. Incorrect: **Неверный логин или пароль**.

## Admin content
### Repertoire
List, not table: cover/title/Edit/Delete. Right-side glass panel.
Fields:
- title
- short_description
- description
- cover_image
- hero_image
- is_premiere
- desktop/mobile hero focal position

Images required. Drag/drop. No draft status.

### Afisha
List, not table: poster/date/performance/Edit/Delete; past muted; side panel.
Fields: linked performance, date only, venue, poster, ticket URL. No time/background image. Chronological, no drag.

### FAQ
List + expandable answer; side panel question/answer; drag/drop.

### Franchise
Two blocks: page statistics + applications.
Application fields: name, city, phone, status, created_at.
Statuses only `new` / `processed`; manual toggle both ways; manual delete with confirmation; no auto deletion. Sidebar shows count of new (`Франшиза · 3`). No CRM/comments/funnels/export/email/automation.

---

# 12. Database (9 tables)

## `performances`
- id
- slug UNIQUE
- title
- short_description
- description
- cover_image
- hero_image
- hero_focus_desktop_x default 50
- hero_focus_desktop_y default 50
- hero_focus_mobile_x default 50
- hero_focus_mobile_y default 50
- is_premiere BOOLEAN default false
- sort_order
- created_at
- updated_at

Slug: server auto from title; lowercase latin/digits/hyphens; unique; max 180; duplicate suffix `-2`; does not auto-change after rename.

## `events`
- id
- performance_id FK
- event_date DATE only
- venue
- poster_image
- ticket_url
- created_at
- updated_at

Performance deletion blocked while linked events exist; no cascade deletion.

## `faq`
- id
- question
- answer
- sort_order
- created_at
- updated_at

## `daily_visitors`
- id BIGINT
- visit_date DATE
- visitor_hash CHAR(64)
- created_at
- UNIQUE(visit_date, visitor_hash)
- INDEX(visit_date)

## `page_views`
- id BIGINT
- page_path VARCHAR(255)
- visitor_hash CHAR(64)
- viewed_at DATETIME
- INDEX(viewed_at)
- INDEX(page_path, viewed_at)

## `ticket_clicks`
- id BIGINT
- event_id nullable
- visitor_hash CHAR(64)
- clicked_at DATETIME
- FK event_id → events.id ON DELETE SET NULL
- INDEX(clicked_at)
- INDEX(event_id, clicked_at)

## `admin`
- id
- login UNIQUE
- password_hash
- created_at
- updated_at

## `admin_tokens`
- id
- admin_id FK ON DELETE CASCADE
- token_hash CHAR(64) UNIQUE
- expires_at
- created_at
- last_used_at
- INDEX(admin_id), INDEX(expires_at)

## `franchise_applications`
- id
- name VARCHAR(100)
- city VARCHAR(100)
- phone VARCHAR(32)
- status ENUM('new','processed') default 'new'
- created_at
- updated_at
- INDEX(status,created_at), INDEX(created_at)

No `daily_stats`. No `background_image`.

---

# 13. Restricted Markdown

Only `performances.description` and `faq.answer`:
Allowed: paragraphs, **bold**, *italic*.
Forbidden: headings, images, links, lists, tables, raw HTML, iframe, code, scripts/styles.
Admin may expose simple B/I editor rather than raw Markdown. Other short fields plain text.

---

# 14. API

Public:
- `GET /api/public/performances`
  returns id, slug, title, short_description, cover_image, is_premiere; sorted by sort_order
- `GET /api/public/performances/{slug}`
  returns id, slug, title, short_description, description, cover_image, hero_image, focal values, is_premiere; unknown = real 404
- `GET /api/public/events`
  only upcoming nearest-first; id,event_date,venue,poster_image,ticket_url + performance.slug/title/is_premiere
- `GET /api/public/faq`
  sorted question/answer
- `POST /api/public/franchise/applications`
- `POST /api/public/analytics/page-view`
- `POST /api/public/analytics/ticket-click`

Admin:
- auth login/logout/me
- statistics
- CRUD performances/events/faq
- reorder performance/faq transactionally
- performance cover/hero replacement endpoints
- event poster replacement
- franchise statistics/list/status/delete/new-count

Use standard JSON envelope:
```json
{"success":true,"data":{}}
```
Errors:
```json
{"success":false,"error":{"code":"...","message":"...","fields":{}}}
```
Use correct 200/201/400/401/404/409/422/429/500.

---

# 15. Validation

Performance:
- title required trim 2–150
- short_description required plain text 20–500
- description required restricted Markdown 50–20000
- slug server-generated unique max 180
- cover + hero mandatory on create
- focal 0–100
- is_premiere boolean

Event:
- performance_id required/existing
- event_date required DATE; past forbidden on create; today allowed
- venue required trim 2–200
- ticket_url required http/https max 2048
- poster mandatory on create

FAQ:
- question required trim 3–300
- answer required 10–10000 restricted Markdown

Franchise:
- name required trim 2–100
- city required trim 2–100
- phone required, source max 32, server normalize; reasonable international support

Client validation for UX + server validation as authority.

---

# 16. Upload/media

Create performance/event via `multipart/form-data`; client never provides filesystem paths.
Pipeline: validate real MIME/decode → resize → WebP → file storage → DB path.
Accepted JPG/JPEG/PNG/WebP, source max ~15MB.
- cover/poster max side ~2000px
- hero ~2560px
- WebP quality ~85
- no auto-crop
- originals not retained
- versioned filenames for cache busting

Paths under `/uploads/performances/{id}/` and `/uploads/events/{id}/`.
Replacement: create/validate new → DB update → delete old; failure preserves old. Delete media only after entity DB deletion succeeds. `/uploads` non-executable. GD or Imagick; Imagick not mandatory.

Hero focal control only for performance `hero_image`: desktop and mobile preview, one file, separate object-position values, default 50/50.

---

# 17. Analytics

Browser gets random `visitor_id`; raw value never stored server-side. PHP creates one-way `visitor_hash` with server secret.

Unique visitor = same browser once per calendar day.
Record page-view only on real route entry/reload, not rerenders/menu/FAQ/resize/animation. Query/UTM excluded from path.

Do not store analytics IP/User-Agent/referrer/exact geo/name/email/phone/UTM.

Timezone calendar: `Europe/Moscow`; technical DATETIME in UTC.
Periods:
- today
- 7d
- 30d = today + previous 29 days

Retention raw analytics: **31 days**.
Comparisons: today vs yesterday; 7d vs previous 7d; 30d no comparison.

Ticket clicks are only **«Клики по билетам»**, never sales/revenue. Ticket link opens immediately; analytics non-blocking (`sendBeacon` or equivalent).

Franchise page stats = `page_path='/franchise'`: today/7d/30d + daily graph.

---

# 18. Rate limiting / anti-spam

No Redis required; protected short-lived server counters. Key from one-way hash(IP+secret); raw IP not stored in analytics/app DB.
- admin login: 5 failed / 15 min → temporary ~15 min block
- franchise: max 3 / 30 min + honeypot
- page-view analytics: 60/min
- ticket-click analytics: 20/min
- authenticated admin API: 120/min

429 on exceed. Analytics 429 invisible; ticket navigation never blocked. Franchise message: **Слишком много попыток. Попробуйте немного позже.**

---

# 19. SEO

No Next.js/SSR Node server.
PHP builds initial SEO HTML shell, React renders UI.
Server-side:
- title
- description
- canonical
- Open Graph
- Schema.org
- real HTTP status

Performance SEO: title from title, description from short_description, OG from cover.
Dynamic `sitemap.xml` from DB performance slugs; `robots.txt`.
Do not detect bots/cloak.
Vite build must generate manifest; PHP uses it to include current hashed JS/CSS.

---

# 20. Deployment / secrets

Concept:
```text
public_html/
├── index.php
├── assets/
├── api/
├── uploads/
├── robots.txt
└── .htaccess

private/
├── config.php
├── cron/
├── logs/
├── backups/
└── runtime/
```

Prefer private outside webroot. Apache public routes → `index.php`, excluding real assets/API/uploads/robots/sitemap. Build locally; never npm/Tauri build on production.

Frontend/Tauri bundles may contain only public API URLs, never DB/admin/server secrets.
Server-only: DB credentials, APP_SECRET, VISITOR_HASH_SECRET.
`.env.example` placeholders allowed; real `.env*`, configs, uploads/runtime ignored by Git.

If feature seems to require a secret in frontend, redesign it so secret remains PHP-side.

---

# 21. Errors / logging

Public generic load error:
> **Не удалось загрузить содержимое**  
> Попробовать снова

Performance 404:
> **Спектакль не найден**

Franchise server fail: preserve inputs, show **Не удалось отправить заявку. Попробуйте ещё раз.**

Production never exposes SQL/stack/path/secrets/PHP warnings. `display_errors=Off`, `log_errors=On`.

Logs outside webroot:
- `app-YYYY-MM-DD.log`
- `error-YYYY-MM-DD.log`
- levels ERROR/WARNING/INFO; DEBUG off
- retention 14 days
- approx 10MB per file then rotate suffix
- use request_id
- never log passwords/tokens/DB password/full Authorization/franchise phone unnecessarily

Admin save/error keeps panel and entered data. Never show success before server persistence confirmation.

---

# 22. Cron / backup

Daily Cron:
1. analytics older than 31 days delete
2. expired admin_tokens delete
3. logs older than 14 days delete
4. backup housekeeping

Never auto-delete franchise applications or media.

Backup:
- MySQL daily, keep 7
- weekly full DB + `/uploads`, keep 4
- outside webroot
- deployment never deletes DB/uploads
- restore docs required: import DB → restore uploads → config verify → site check
- after DB restore clear `admin_tokens`; admin relogs
- production secrets backed up separately by owner

---

# 23. Performance/non-functional requirements

Primary goal: smooth public site and seamless navigation.
- route/code splitting
- prioritize first/current visual
- lazy below-fold assets
- preload next visual where useful
- optimized WebP/video
- self-host fonts, only needed weights
- avoid unnecessary React rerenders
- no animation queues
- animations must not block navigation
- mobile lighter effects
- preserve scroll positions
- reduced-motion support
- no heavy slider library
- do not sacrifice smoothness for decoration

Loading: no generic spinner/progress/skeleton cards. Hero poster first, then video.

---

# 24. Hard constraints for Codex

Do **not**:
- change approved copy
- change scene order
- invent sections/features/entities
- reintroduce `background_image`
- add event time
- add buy outside Afisha
- use Liquid Glass public
- turn public UI into card/app UI
- add Franchise CRM/email
- add fake/demo performances/events
- replace owner-provided assets with invented ones
- simplify/alter About text+photo composition
- alter Hero slogan
- sacrifice smooth transitions for visual effects

Any extension requires explicit owner approval.
