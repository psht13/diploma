# UI Polish Notes

## Вихідні проблеми

- Button groups виглядали затісно: `gap: 12px` було достатнім функціонально, але візуально кнопки злипалися, особливо в editor/memory panels.
- Async-сценарії не мали достатньо явного pending-state:
  - перевірка статусу моделі;
  - генерація вправи;
  - запуск тестів;
  - підготовка фідбеку після тестів;
  - пояснення теми;
  - експорт сесії.
- Користувач міг бачити нерухому сторінку під час LLM/fallback-виклику і не розуміти, чи система працює, чи зависла.

## Що змінено

- У [main.js](/Users/pavloyurchenko/Documents/labs/diploma/prototype/src/main.js):
  - `activity-card` використано як центральний live status hub;
  - додано централізований `activeUiTask` для busy/pending станів;
  - для кожної релевантної дії додано явні title/detail messages;
  - кнопки під час async-flow переходять у disabled state і міняють label;
  - під час генерації, запуску тестів і пояснення відображаються pending cards для exercise/test summary/feedback;
  - transcript показує pending bubble від імені репетитора;
  - статус моделі під час refresh тепер має inline loader;
  - export використовує `requestAnimationFrame`-based paint wait, щоб pending-state встиг з’явитися до download.
- У [styles.css](/Users/pavloyurchenko/Documents/labs/diploma/prototype/styles.css):
  - button spacing збільшено до `14px`;
  - вертикальні відступи action areas вирівняно до `20px`;
  - кнопки отримали трохи більшу висоту, padding і `flex-basis`;
  - додано `status-inline` і `spinner-inline`;
  - mobile stacking для grouped buttons лишився повноширинним.
- У [index.html](/Users/pavloyurchenko/Documents/labs/diploma/prototype/index.html):
  - додано `data:` favicon, щоб прибрати зайвий `favicon.ico` 404 у console.

## Tailwind / Skill Use

- Tailwind: не використовувався.
- `ui-ux-pro-max`: використано для швидкого design-system sanity check під educational tutor UI.
- `playwright`: використано для браузерної перевірки після патча.

## Що перевірено в браузері

- `generate exercise`:
  - видно disabled state на кнопках;
  - exercise card, feedback card і transcript показують pending-state;
  - після завершення fallback-вправа з’являється коректно.
- `run tests`:
  - підсумок тестів оновлюється;
  - feedback panel показує результат після прогону;
  - transcript поповнюється студентською спробою та відповіддю репетитора.
- `explain request`:
  - запит додається в transcript;
  - після обробки з’являється концептуальне пояснення;
  - `lastAction` переходить у `concept_explanation`.
- `export session`:
  - JSON download підтверджено через Playwright download event;
  - feedback panel показує підтвердження експорту.

## Нотатки

- Для браузерної перевірки навмисно використовувався неіснуючий model id `missing-model`, щоб швидко перевірити fallback-шлях без очікування реальної генерації локальною моделлю.
- Console noise від `http://localhost:11434/api/generate` у цьому сценарії очікуваний і відбиває саме fallback-поведінку, а не збій UI.
