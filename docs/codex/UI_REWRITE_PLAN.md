# UI Rewrite Plan

## Constraints

- Архітектура, бізнес-логіка, LLM pipeline, API та назви концептуальних модулів не змінюються.
- Tailwind не використовується.
- Основний стек: наявний HTML + vanilla CSS + presentation-layer оновлення в `main.js`.

## Design Direction

### Product character

- Спокійний, академічно-нейтральний, сучасний tutoring workspace.
- Світлий інтерфейс без кислотних акцентів і без декоративного перевантаження.
- Відчуття guided tutoring flow замість internal tool layout.

### Design system

- Typography:
  - headings: `Source Serif 4`
  - UI/body: `Manrope`
- Core palette:
  - page background: `#eff4fb`
  - surface: `#ffffff / rgba(255,255,255,0.88)`
  - primary accent: `#2f5ea7`
  - success: `#17795a`
  - warning: `#a56a1f`
  - danger: `#b5474f`
- Radius:
  - cards/panels: `20-28px`
- Shadows:
  - soft layered shadows, без heavy glassmorphism
- Spacing:
  - 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 px scale

## `ui-ux-pro-max` Adaptation

- Від тулу взято:
  - вимогу до явних loading states;
  - фокус на clear hierarchy і modular type scale;
  - touch spacing;
  - calm product palette family.
- Відхилено буквальний `App Store style landing`, запропонований тулом у design-system output.
  Причина: прототип є single-screen tutoring workspace, а не маркетингова landing page.

## Structural rewrite

1. Hero + model status
   - Виноситься окремий сильний status card.
   - Модель має чіпи стану `checking / ready / fallback / unavailable`.

2. Guided flow
   - Екран структурується як `Крок 1-4`.
   - Memory/transcript панель отримує повну ширину, щоб діалог не виглядав притиснутим.

3. Exercise card
   - Розбити на окремі presentation blocks:
     - формулювання задачі
     - сигнатура функції
     - початковий код
     - критерії оцінювання
     - поняття
     - перевірочні тести

4. Results and feedback
   - Summary card: окремий head, metrics, detail rows, next step.
   - Feedback card: окремі секції `коротке пояснення / наступний крок`.

5. Transcript
   - Bubble-based layout.
   - Явне розрізнення ролей `Студент / Репетитор`.
   - Pending tutor bubble під час очікування.

## Loading-state strategy

- Central busy status: `activity-card`
- Local pending surfaces:
  - exercise card
  - test summary
  - feedback card
  - transcript bubble
- Disabled buttons with busy copy:
  - `Перевіряється...`
  - `Генерується вправа...`
  - `Виконується перевірка...`
  - `Готується пояснення...`
  - `Готується експорт...`

## Files in scope

- `prototype/index.html`
- `prototype/styles.css`
- `prototype/src/main.js`

## Explicitly out of scope

- service-layer refactor
- session/state schema changes
- Ollama integration changes
- worker/runtime changes
- renaming conceptual architecture from the coursework
