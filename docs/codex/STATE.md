# Поточний стан роботи

## Статус

- 16.03.2026 сформовано фінальний submission-артефакт [coursework_draft_ua_submission_ready_v6.docx](/Users/pavloyurchenko/Documents/labs/diploma/output/coursework_draft_ua_submission_ready_v6.docx).
- Template [coursework_draft_ua_submission_ready_template.docx](/Users/pavloyurchenko/Documents/labs/diploma/assets/coursework_draft_ua_submission_ready_template.docx) розпарсено на OOXML-рівні; результати зафіксовано в [TEMPLATE_PARSE.json](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/TEMPLATE_PARSE.json) і [TEMPLATE_STYLE_MANIFEST.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/TEMPLATE_STYLE_MANIFEST.md).
- Через відсутність `output/coursework_draft_ua_submission_ready_v5.docx` як editable baseline використано [coursework_submission_stage_v3.docx](/Users/pavloyurchenko/Documents/labs/diploma/tmp/docs/submission_ready_v3/coursework_submission_stage_v3.docx); фінальні `v5` PDF/PNG-артефакти та попередні нотатки використано як референс для content polish.

## Що зроблено

- Геометрію документа переведено на template-baseline: A4, поля `20 / 10 / 20 / 20 мм`, title-page section, header/footer distances `12.7 мм`.
- Синхронізовано лічильники на титулі, в анотації та в abstract: `40 с. / pages`, `4 рисунки / figures`, `13 таблиць / tables`, `4 додатки / appendices`, `30 джерел / references`.
- Статичний зміст перебудовано за фінальним рендером; сторінка `СПИСОК УМОВНИХ ПОЗНАЧЕНЬ` виправлена з помилкового `4` на фактичну `6`.
- Прибрано залишкові dev-log/meta формулювання: `автентичні фрагменти`, `не вигадувалися`, `npm`, `Playwright`, `локальний виклик Ollama`, `полегшений JSON-експорт`, `ШІ-репетиторing`, `systems` у наративному тексті.
- У 3.4 та 3.5.1 оновлено формалізацію агента: замінено сирі JSON-поля на природний опис, формулу `Topic / Attempts / Ctx / Text` замінено на `Th / N / Cx / V`.
- У 4.4.1, 4.5 та таблицях розділу 4 нормалізовано назви перевірок до академічніших формулювань: `модульні тести`, `сценарна функціональна перевірка`, `браузерна функціональна перевірка`, `перевірка роботи локальної моделі Ollama`.
- У списку умовних позначень вилучено рядок про `Модель стану студента`; лишено коректний рядок `UserState - спрощена модель стану студента в прототипі`.
- Code/prompt blocks у додатках Б, В, Г збережено в моноширинному форматі; локалізація file paths, identifiers і model names у кодових фрагментах не застосовувалася.
- Прототип у [prototype/index.html](/Users/pavloyurchenko/Documents/labs/diploma/prototype/index.html), [prototype/styles.css](/Users/pavloyurchenko/Documents/labs/diploma/prototype/styles.css) і [main.js](/Users/pavloyurchenko/Documents/labs/diploma/prototype/src/main.js) допрацьовано без Tailwind: button groups отримали рівніший gap, `activity-card` став центральним busy-state індикатором, з'явилися pending cards, transcript pending bubble, disabled states і inline loader для статусу моделі.

## Підсумкові параметри `v6`

- 40 сторінок.
- 4 рисунки.
- 13 змістовних таблиць плюс 1 службова layout-таблиця на титулі.
- 4 додатки.
- 30 джерел.
- Формат сторінки: A4 (`210.009 x 297.004 мм`).

## Перевірка

- DOCX відрендерено в [submission_ready_v6_final](/Users/pavloyurchenko/Documents/labs/diploma/tmp/docs/submission_ready_v6_final); переглянуто титул, TOC, список умовних позначень, формульний блок 3.5.1, бібліографію та appendix code page.
- Автоматичний style audit для `v6` не виявив paragraph-level або run-level відхилень від template-моделі; section geometry збігається з template.
- UI перевірено в браузері через Playwright для сценаріїв `generate exercise`, `run tests`, `explain request`, `export session`; експорт JSON підтверджено фактичним download-артефактом у `.playwright-cli/`.
- Локальні JS-тести пройдено: `node --test prototype/tests/*.mjs`.
- Синтаксис frontend entrypoint перевірено: `node --check prototype/src/main.js`.

## Де лежать артефакти

- DOCX: [coursework_draft_ua_submission_ready_v6.docx](/Users/pavloyurchenko/Documents/labs/diploma/output/coursework_draft_ua_submission_ready_v6.docx)
- PDF/PNG рендер: [submission_ready_v6_final](/Users/pavloyurchenko/Documents/labs/diploma/tmp/docs/submission_ready_v6_final)
- UI validation artifacts: [output/playwright](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright)
