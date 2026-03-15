# Стан коду після виправлень

## Автоматично виправлено

1. `prototype/src/services/tutorPolicy.js`, `prototype/src/core/runResult.js`
- Policy bug усунуто.
- Перша помилка тепер дає `minimal_hint`.
- Повторна та сама помилка дає `targeted_hint`.
- Додатково правило ескалації для різних помилок відсунуте на третю невдалу спробу.

2. `prototype/src/services/feedbackEvaluator.js`
- Fallback explanation більше не дублює студентський запит.
- Резервний фідбек формує змістовне концептуальне пояснення.

3. `prototype/src/core/contracts.js`, `prototype/src/services/ollamaClient.js`, `prototype/src/services/exerciseGenerator.js`, `prototype/src/services/feedbackEvaluator.js`
- Додано явну schema validation для exercise JSON і feedback JSON.
- Некоректний parseable JSON (`null`, масив, рядок, частковий об'єкт) більше не валить прототип.
- При schema mismatch виконується retry/fallback.

4. `prototype/src/main.js`
- Модель із `#model-input` синхронізується перед кожним LLM-викликом.
- UI більше не вводить в оману щодо того, яка модель буде використана.

5. `prototype/src/main.js`
- Додано дружній error handling для генерації вправи, запуску тестів, пояснення й перевірки статусу.
- Додано `console.error` diagnostics без ламання UX.

6. `prototype/src/services/clientTestRunner.js`, `prototype/src/services/sandboxExecution.js`, `prototype/src/workers/jsSandboxWorker.js`
- Додано validation `functionName` як JS identifier.
- Додано validation sandbox payload.
- Додано `worker.onerror` і `messageerror`.
- Timeout path обробляється і покритий тестами.
- Для MVP обмежено низку небажаних глобалів під час виконання коду.

7. `prototype/tests/`
- Покриття тестами розширено до 24 unit-тестів.
- Додано кейси на:
  - першу та повторну помилку policy;
  - fallback explanation;
  - invalid JSON schema;
  - retry/fallback у `OllamaClient`;
  - missing function;
  - timeout path;
  - validation `functionName`.

8. `package.json`, `prototype/README.md`
- Додано `npm run serve`.
- У README явно зафіксовано, що worker не є повноцінною security sandbox boundary.

## Залишкові технічні обмеження

1. Worker sandbox
- Поточний `Web Worker` суттєво посилено, але це все ще не повноцінна безпекова пісочниця.
- Це чесно задокументовано як обмеження MVP.

2. Практичний LLM runtime
- Повний browser-based E2E-сценарій із локально встановленим `ollama` і моделлю `llama3.1:8b` потребує ручного запуску в середовищі користувача.

## Необов'язкові подальші покращення

1. `prototype/src/main.js`
- За потреби можна додатково винести UI orchestration у дрібніші модулі.

2. Репозиторій загалом
- Session logging/export для майбутнього A/B або crossover експерименту поки не реалізовано.
