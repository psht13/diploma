import { getFallbackExercise } from "../content/fallbackExercises.js";
import { validateExercisePayload } from "../core/contracts.js";
import { TOPIC_LABELS } from "../core/constants.js";

const GENERIC_TEST_NAME_PATTERN = /^(?:test|case|scenario|тест|сценарій)\s*#?\s*\d+$/iu;

function formatCompactValue(value, maxLength = 42) {
  let text;

  if (value === undefined) {
    text = "undefined";
  } else if (value === null) {
    text = "null";
  } else if (typeof value === "string") {
    text = `«${value}»`;
  } else {
    text = JSON.stringify(value);
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function hasMeaningfulTestName(name) {
  return typeof name === "string" && name.trim().length > 0 && !GENERIC_TEST_NAME_PATTERN.test(name.trim());
}

function buildMeaningfulTestName(test) {
  const args = Array.isArray(test?.args) ? test.args : [];
  const expectedText = formatCompactValue(test?.expected, 20);

  if (args.length === 1) {
    const [firstArg] = args;

    if (Array.isArray(firstArg)) {
      return `повертає ${expectedText} для масиву ${formatCompactValue(firstArg)}`;
    }

    if (firstArg && typeof firstArg === "object") {
      return `повертає ${expectedText} для об'єкта ${formatCompactValue(firstArg)}`;
    }

    return `повертає ${expectedText} для значення ${formatCompactValue(firstArg, 24)}`;
  }

  if (args.length > 1) {
    return `повертає ${expectedText} для аргументів ${formatCompactValue(args)}`;
  }

  return `повертає ${expectedText} у базовому сценарії`;
}

function normalizeTests(tests, fallbackTests) {
  if (!Array.isArray(tests) || tests.length === 0) {
    return fallbackTests;
  }

  const validTests = tests
    .filter((test) => test && typeof test.name === "string" && Array.isArray(test.args))
    .map((test) => ({
      name: hasMeaningfulTestName(test.name) ? test.name.trim() : buildMeaningfulTestName(test),
      args: test.args,
      expected: test.expected
    }));

  return validTests.length ? validTests : fallbackTests;
}

function normalizeExercise(raw, fallback, topicKey, difficulty, meta) {
  const normalizedSourceMeta = meta ?? { source: "fallback" };
  const concepts = Array.isArray(raw.concepts) && raw.concepts.length ? raw.concepts : fallback.concepts;
  const rubric = Array.isArray(raw.rubric) && raw.rubric.length ? raw.rubric : fallback.rubric;

  return {
    id: typeof raw.id === "string" ? raw.id : fallback.id,
    topicKey,
    topic: typeof raw.topic === "string" ? raw.topic : TOPIC_LABELS[topicKey],
    difficulty,
    title: typeof raw.title === "string" ? raw.title : fallback.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : fallback.prompt,
    starterCode: typeof raw.starterCode === "string" ? raw.starterCode : fallback.starterCode,
    functionName:
      typeof raw.functionName === "string" && raw.functionName.trim()
        ? raw.functionName.trim()
        : fallback.functionName,
    concepts,
    rubric,
    tests: normalizeTests(raw.tests, fallback.tests),
    source: normalizedSourceMeta.source
  };
}

function buildExercisePrompt({ topicKey, difficulty }) {
  return `
Ти виконуєш роль репетитора з базового JavaScript.
Поверни лише JSON-об'єкт без пояснень.

Вимоги:
- тема: ${TOPIC_LABELS[topicKey]};
- складність: ${difficulty};
- одна невелика вправа для початківця;
- не вимагай DOM, мережу, файли, зовнішні бібліотеки;
- очікується одна функція;
- тести мають містити лише структуру name, args, expected;
- name для кожного тесту має коротко описувати поведінку сценарію;
- заборонено generic-назви на кшталт test1, test2, case1 або scenario2;
- не включай повний розв'язок;
- starterCode має містити сигнатуру функції та коментар-заглушку.

Очікувані поля JSON:
{
  "id": "string",
  "topic": "string",
  "title": "string",
  "prompt": "string",
  "starterCode": "string",
  "functionName": "string",
  "concepts": ["string"],
  "rubric": ["string"],
  "tests": [
    { "name": "string", "args": [], "expected": "any valid JSON value" }
  ]
}
`.trim();
}

export class ExerciseGenerator {
  constructor({ ollamaClient }) {
    this.ollamaClient = ollamaClient;
  }

  async generate({ topicKey = "functions", difficulty = "basic" }) {
    const fallback = getFallbackExercise(topicKey, difficulty);
    const prompt = buildExercisePrompt({ topicKey, difficulty });
    const result = await this.ollamaClient.generateJson({
      prompt,
      fallback,
      validate: validateExercisePayload
    });

    const validation = validateExercisePayload(result.data);
    const safeData = validation.ok ? result.data : fallback;
    const safeMeta = validation.ok
      ? result.meta
      : {
          ...result.meta,
          source: "fallback",
          reason: "schema mismatch after client validation"
        };

    return normalizeExercise(safeData, fallback, topicKey, difficulty, safeMeta);
  }
}
