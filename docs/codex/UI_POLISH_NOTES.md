# UI Polish Notes

## Підсумок реалізації

- UI переписано через HTML/CSS/JS presentation layer.
- Tailwind не використовувався.
- Логіку сервісів, модель стану, worker, Ollama integration і session export не змінено.

## Browser verification

### 1. Generate exercise

- Перевірено pending-state:
  - disabled primary button з busy copy;
  - central `activity-card`;
  - pending surface в exercise card;
  - pending surface в summary card;
  - pending surface в feedback card;
  - pending tutor bubble у transcript.
- Layout не стрибає: картки зберігають габарити й не схлопуються під час очікування.

### 2. Run tests

- Під час перевірки кнопки блокуються коректно.
- Summary card після завершення показує:
  - `пройдено`;
  - `потребує уваги`;
  - `усього тестів`;
  - рядки `пройдено / не пройдено`.
- Під час формування відповіді агента фідбек-панель має окремий pending state.

### 3. Explain

- Запит студента потрапляє в transcript.
- Під час очікування з'являється explicit state `Агент готує пояснення...`.
- Після завершення feedback card перемикається в режим пояснення й не виглядає як системний debug block.

### 4. Feedback after tests

- Після тестів фідбек і summary візуально розділені.
- Користувач одразу бачить:
  - підсумок перевірки;
  - перший зрозумілий next step;
  - окремий репетиторський фідбек.

### 5. Model status check

- Статус локальної моделі тепер має окремі visual states:
  - `checking`
  - `ready`
  - `fallback`
  - `unavailable`
- На дуже швидкому локальному відповіді refresh може завершуватися майже миттєво, але explicit checking-state у коді присутній і рендериться до await.

### 6. Export session

- Під час експорту button переходить у busy state.
- `activity-card` показує explicit export progress.
- Після завершення з'являється системне підтвердження в feedback card.
- Browser download підтверджено фактичним файлом.

## Responsive verification

- На `390x844` кнопки стекуються в одну колонку.
- Gap між button groups зберігається.
- Hero, panels і transcript не ламають layout.

## Артефакти

- before rewrite: [before-redesign-desktop.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/before-redesign-desktop.png)
- after rewrite desktop: [home-desktop.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/home-desktop.png)
- after rewrite mobile: [home-mobile.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/home-mobile.png)
- in-session desktop: [session-desktop.png](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/session-desktop.png)
- exported session sample: [ains-session-функції-2026-03-16T09-50-45-408Z.json](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite/ains-session-функції-2026-03-16T09-50-45-408Z.json)

## Residual notes

- Web fonts завантажуються з Google Fonts; у повністю offline demo треба перевірити acceptable fallback rendering.
- Ручна заміна screenshot у DOCX, якщо вона потрібна для submission, лишається поза автоматичним пайплайном.
