# Format Deviation Report

## Inputs

- Template baseline: [coursework_draft_ua_submission_ready_template.docx](/Users/pavloyurchenko/Documents/labs/diploma/assets/coursework_draft_ua_submission_ready_template.docx)
- Editable working baseline: [coursework_submission_stage_v3.docx](/Users/pavloyurchenko/Documents/labs/diploma/tmp/docs/submission_ready_v3/coursework_submission_stage_v3.docx)
- Final normalized output: [coursework_draft_ua_submission_ready_v6.docx](/Users/pavloyurchenko/Documents/labs/diploma/output/coursework_draft_ua_submission_ready_v6.docx)

## Що було знайдено до правок

- Секційна геометрія working DOCX не збігалася з template:
  - template: `210.009 x 297.004 мм` (A4);
  - working baseline: `215.9 x 279.4 мм` (letter).
- У working baseline були застарілі службові значення:
  - статичний TOC з `\t0`;
  - старі лічильники `38 с. / 38 pages` всередині DOCX при більшому фактичному рендері;
  - відсутній рядок лічильників на титулі, який уже був у фінальному `v5` PDF.
- Виявлено залишкові змістові й мовні збої:
  - dev-log тон у 4.4.1 та 4.5;
  - мета-лексика `автентичні фрагменти`, `не вигадувалися`;
  - прямі згадки `npm`, `Playwright`, `локальний виклик Ollama`, `полегшений JSON-експорт` у наративі;
  - зламаний бібліографічний запис `[21]` (`ШІ-репетиторing ...`);
  - застарілі формальні позначення `Topic / Attempts / Ctx / Text`;
  - рядок `Модель стану студента ...` у списку умовних позначень.
- У таблицях знайшлися narrative-level технічні формулювання, які не відповідали академічному тону:
  - `модульні тести (npm test)`;
  - `контрольна перевірка (npm run check)`;
  - `Playwright + локальна Ollama`;
  - `Не вигадувати результати експериментів`.

## Що виправлено у `v6`

- Геометрію документа приведено до template baseline:
  - `pgSz`, `pgMar`, `header_distance`, `footer_distance`, title-page section.
- Пересинхронізовано:
  - титульний лічильник;
  - анотацію;
  - abstract;
  - статичний TOC.
- Фактичні лічильники `v6`:
  - `40 с. / pages`;
  - `4 рисунки / figures`;
  - `13 таблиць / tables`;
  - `4 додатки / appendices`;
  - `30 джерел / references`.
- Нормалізовано змістові збої:
  - сирі JSON-поля в 3.4 замінено на природний опис;
  - формулу агента оновлено до `Th / N / Cx / V`;
  - `Функціональна валідація прототипу` замінено на `Функціональна перевірка прототипу`;
  - dev-log/meta формулювання прибрано з розділів 4 і додатка Б;
  - бібліографічний запис `[21]` виправлено на оригінальну англомовну назву.
- Для списку умовних позначень вибрано безпечний варіант із умови задачі:
  - некоректний рядок `Модель стану студента ...` вилучено;
  - коректний технічний запис `UserState - спрощена модель стану студента в прототипі` лишено.
- Table scan після нормалізації:
  - `14` таблиць загалом;
  - `13` змістовних таблиць;
  - title layout-table не рахується як змістовна.
- Code/prompt blocks не проходили через мовну нормалізацію; у додатках Б, В, Г збережено file paths, identifiers, JSON keys і model names.

## Фінальний автоматичний аудит `v6`

- Styles missing vs template: `[]`.
- Extra styles vs template: `[]`.
- Section geometry: збігається з template baseline.
- Paragraph-level anomalies vs tracked template style model: не виявлено.
- Run-level anomalies vs tracked template style model: не виявлено.
- Forbidden meta-lexicon hits поза code/prompt blocks: не виявлено.

## Пропущені manual font/style glitches

- Після фінального скану випадкових шрифтів, розмірів або жирності поза deliberate template exceptions не виявлено.
- Очікувані винятки лишаються тільки там, де вони закладені самим template:
  - титульний блок;
  - службова layout-таблиця на титулі;
  - content-driven bold runs усередині `DialogueBlock`/caption contexts, якщо вони задані самим текстом.

## Що ще лишається на ручний контроль

- Відкрити [coursework_draft_ua_submission_ready_v6.docx](/Users/pavloyurchenko/Documents/labs/diploma/output/coursework_draft_ua_submission_ready_v6.docx) у desktop Word/LibreOffice і зробити останній human-eye pass перед поданням.
- Експортувати фінальний PDF тим самим office-renderer, який буде використано для submission.
- Якщо кафедра вимагає живі підписи або додатковий реквізит на титулі, це лишається поза автоматичним пайплайном.
