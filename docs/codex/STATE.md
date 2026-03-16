# Поточний стан роботи

## Статус

- 16.03.2026 повторно розпарсено template [coursework_draft_ua_submission_ready_template.docx](/Users/pavloyurchenko/Documents/labs/diploma/assets/coursework_draft_ua_submission_ready_template.docx) і фінальний submission-ready DOCX [coursework_draft_ua_submission_ready_v6.docx](/Users/pavloyurchenko/Documents/labs/diploma/output/coursework_draft_ua_submission_ready_v6.docx).
- Файли [TEMPLATE_PARSE.json](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/TEMPLATE_PARSE.json), [TEMPLATE_STYLE_MANIFEST.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/TEMPLATE_STYLE_MANIFEST.md) і [FORMAT_DEVIATION_REPORT.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/FORMAT_DEVIATION_REPORT.md) оновлено на основі свіжого parse/compare.
- UI прототипу в [prototype/index.html](/Users/pavloyurchenko/Documents/labs/diploma/prototype/index.html), [prototype/styles.css](/Users/pavloyurchenko/Documents/labs/diploma/prototype/styles.css) і [main.js](/Users/pavloyurchenko/Documents/labs/diploma/prototype/src/main.js) переписано як CSS-first redesign без Tailwind і без зміни архітектури, LLM pipeline чи бізнес-логіки.
- Обов'язковий audit проведено із застосуванням `ui-ux-pro-max`, parse DOCX і браузерної перевірки через Playwright.

## Що зроблено

- Узгоджено UI copy з термінологією курсової:
  - збережено ключові терміни `вправа`, `розв'язок`, `перевірочні тести`, `режим пояснення`, `пам'ять сесії`, `модель стану студента`, `резервний режим`;
  - прибрано сирі dev/demo формулювання на кшталт `vertical slice` і `Session Memory`.
- Побудовано новий visual direction:
  - спокійна академічно-нейтральна палітра;
  - нова типографічна пара `Manrope` + `Source Serif 4`;
  - CSS variables для кольорів, spacing scale, radius, shadows і state tones.
- Перекомпоновано presentation layer без зміни data flow:
  - hero з чітким статусом локальної моделі;
  - guided flow `Крок 1-4`;
  - `memory`-panel розширено до окремої ширини з діалогом і моделлю стану студента;
  - transcript перетворено на повноцінний bubble-based діалог.
- Посилено станами очікування:
  - `checking / ready / fallback / unavailable` для локальної моделі;
  - виразні loaders для `generate`, `run tests`, `feedback after tests`, `explain`, `export`;
  - panel-local pending cards і transcript pending bubble.
- Exercise/result UI переписано:
  - вправа поділена на блоки `формулювання задачі / сигнатура / початковий код / критерії оцінювання / поняття / перевірочні тести`;
  - test results тепер мають summary, metrics, pass/fail rows і наступний крок;
  - feedback card відокремлює коротке пояснення від наступного кроку.
- Зібрано нові артефакти для ручної заміни скріншотів у coursework:
  - [before-redesign-desktop.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/before-redesign-desktop.png)
  - [home-desktop.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/home-desktop.png)
  - [home-mobile.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/home-mobile.png)
  - [session-desktop.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/session-desktop.png)

## Перевірка

- `node --check prototype/src/main.js`
- `node --test prototype/tests/*.test.mjs`
- Playwright verification for:
  - status refresh
  - generate exercise
  - run tests
  - explain
  - export session
- Під час browser pass підтверджено download JSON-експорту:
  - [ains-session-функції-2026-03-16T09-50-45-408Z.json](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/ains-session-функції-2026-03-16T09-50-45-408Z.json)

## Де лежать ключові артефакти

- DOCX parse: [TEMPLATE_PARSE.json](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/TEMPLATE_PARSE.json)
- Template style baseline: [TEMPLATE_STYLE_MANIFEST.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/TEMPLATE_STYLE_MANIFEST.md)
- DOCX compare: [FORMAT_DEVIATION_REPORT.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/FORMAT_DEVIATION_REPORT.md)
- UI audit: [UI_UX_AUDIT.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/UI_UX_AUDIT.md)
- UI rewrite plan: [UI_REWRITE_PLAN.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/UI_REWRITE_PLAN.md)
- UI copy alignment: [UI_COPY_ALIGNMENT.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/UI_COPY_ALIGNMENT.md)
- UI polish notes: [UI_POLISH_NOTES.md](/Users/pavloyurchenko/Documents/labs/diploma/docs/codex/UI_POLISH_NOTES.md)

## Залишок ручного контролю

- Desktop Word/LibreOffice pass для фінального DOCX лишається обов'язковим.
- Якщо в курсовій треба оновити UI screenshot, заміна в DOCX лишається ручною.
- Якщо демонстраційне середовище буде без інтернету, треба окремо перевірити acceptable fallback для web-fonts.
