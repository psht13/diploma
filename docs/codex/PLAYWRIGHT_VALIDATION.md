# Playwright Validation

## Дата

- 15.03.2026

## Підготовка середовища

- Прототип запускався локально на `http://localhost:4173/prototype/`.
- Локальний HTTP-сервер уже був доступний на порту `4173`.
- Доступність Ollama перевірено двома способами:
  - `curl http://localhost:11434/api/tags`;
  - `ollama list`.
- Підтверджено локальну модель `llama3.1:8b`.

## Інструмент

- Використано skill `playwright` через `playwright-cli`.
- Браузер у сесії Playwright: `chrome`.

## Фактичний сценарій

1. Відкрито `http://localhost:4173/prototype/` і перевірено статус LLM у UI.
2. Згенеровано вправу з теми `Функції`; у картці вправи підтверджено `Джерело: ollama`.
3. Введено завідомо хибний код для `squareNumber` і двічі запущено тести.
4. Після першого прогону зафіксовано `lastAction = minimal_hint`.
5. Після повторної тієї самої помилки зафіксовано `lastAction = targeted_hint`.
6. У поле запиту введено нейтральний текст `Що робити далі?` без слова `поясни`, після чого натиснуто кнопку `Пояснити тему`.
7. Підтверджено, що система переходить у `concept_explanation` через explicit explain-mode, а не лише через текстову евристику.
8. Натиснуто `Експортувати сесію JSON` і перевірено фактичний файл експорту.

## Результати

- Повний браузерний сценарій із локальною Ollama пройдено.
- У процесі прогону було виявлено й одразу виправлено:
  - надто короткий тайм-аут Ollama для `llama3.1:8b`;
  - некоректне збереження `firstFailure` між вправами;
  - відсутність явного показу `functionName` у UI вправи.
- Після виправлень повторний прогін підтвердив:
  - генерацію вправи локальною моделлю;
  - коректну ескалацію `minimal_hint -> targeted_hint`;
  - явний режим пояснення через кнопку;
  - коректний JSON-експорт поточної сесії.

## Перевірений JSON-експорт

- Файл: `output/playwright/validation/session-export.json`
- Підтверджені ключі:
  - `topic`
  - `difficulty`
  - `attemptsCount`
  - `firstFailure`
  - `lastAction`
  - `transcript`
  - `finalRunStatus`
  - `timestamp`

## Артефакти

- `output/playwright/validation/generation-ollama.png`
- `output/playwright/validation/explanation-flow.png`
- `output/playwright/validation/session-export.json`
- Проміжний некоректний експорт до фікса `firstFailure` перенесено в архів:
  - `output/playwright/validation/archive/ains-session-функції-2026-03-15T14-38-34-090Z.json`

## Висновок

- Технічна функціональна валідація через реальний браузер і локальну `Ollama` завершена успішно.
- Педагогічний експеримент зі студентами не проводився; цей файл фіксує лише технічний e2e-прогін прототипу.
