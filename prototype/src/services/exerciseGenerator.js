import { getFallbackExercise } from "../content/fallbackExercises.js";
import { TOPIC_LABELS } from "../core/constants.js";

function normalizeTests(tests, fallbackTests) {
  if (!Array.isArray(tests) || tests.length === 0) {
    return fallbackTests;
  }

  const validTests = tests
    .filter((test) => test && typeof test.name === "string" && Array.isArray(test.args))
    .map((test) => ({
      name: test.name,
      args: test.args,
      expected: test.expected
    }));

  return validTests.length ? validTests : fallbackTests;
}

function normalizeExercise(raw, fallback, topicKey, difficulty, meta) {
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
    source: meta.source
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
      fallback
    });

    return normalizeExercise(result.data, fallback, topicKey, difficulty, result.meta);
  }
}
