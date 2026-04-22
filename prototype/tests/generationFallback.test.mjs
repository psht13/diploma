import test from "node:test";
import assert from "node:assert/strict";

import { ExerciseGenerator } from "../src/services/exerciseGenerator.js";
import { FeedbackEvaluator } from "../src/services/feedbackEvaluator.js";

const invalidPayloads = [
  { label: "null", value: null },
  { label: "array", value: [] },
  { label: "string", value: "not-an-object" },
  { label: "partial object", value: { title: "Only title" } }
];

const feedbackContext = {
  exercise: {
    title: "Сума елементів масиву",
    topic: "Функції",
    functionName: "sumArray",
    concepts: ["масиви", "цикли"]
  },
  runResult: {
    allPassed: false,
    syntaxError: null,
    failures: [{ name: "порожній масив", expected: 0, actual: 1 }]
  },
  userState: {
    attemptsCount: 1,
    errorHistory: [{ detail: "порожній масив" }]
  },
  policy: { action: "minimal_hint" },
  studentRequest: ""
};

for (const { label, value } of invalidPayloads) {
  test(`ExerciseGenerator falls back safely for ${label} payload`, async () => {
    const generator = new ExerciseGenerator({
      ollamaClient: {
        async generateJson() {
          return {
            data: value,
            meta: { source: "ollama" }
          };
        }
      }
    });

    const exercise = await generator.generate({
      topicKey: "functions",
      difficulty: "basic"
    });

    assert.equal(exercise.source, "fallback");
    assert.equal(exercise.functionName, "sumArray");
    assert.ok(exercise.tests.length > 0);
  });
}

for (const { label, value } of invalidPayloads) {
  test(`FeedbackEvaluator falls back safely for ${label} payload`, async () => {
    const evaluator = new FeedbackEvaluator({
      ollamaClient: {
        async generateJson() {
          return {
            data: value,
            meta: { source: "ollama" }
          };
        }
      }
    });

    const feedback = await evaluator.evaluate(feedbackContext);

    assert.equal(feedback.source, "fallback");
    assert.ok(feedback.summary.length > 0);
    assert.ok(feedback.nextStep.length > 0);
  });
}

test("ExerciseGenerator rewrites generic test names into meaningful labels", async () => {
  const generator = new ExerciseGenerator({
    ollamaClient: {
      async generateJson() {
        return {
          data: {
            id: "objects-most-values-key",
            topic: "Об'єкти",
            title: "Пошук ключа з найбільшою кількістю значень",
            prompt: "Повернути ключ з найбільшою кількістю значень в об'єкті.",
            starterCode: "function mostValuesKey(obj) {}",
            functionName: "mostValuesKey",
            concepts: ["об'єкти", "цикли"],
            rubric: ["коректність", "читабельність"],
            tests: [
              { name: "test1", args: [{ a: [1, 2], b: [3] }], expected: "a" },
              { name: "scenario2", args: [{}], expected: null }
            ]
          },
          meta: { source: "ollama" }
        };
      }
    }
  });

  const exercise = await generator.generate({
    topicKey: "objects",
    difficulty: "basic"
  });

  assert.equal(exercise.source, "ollama");
  assert.notEqual(exercise.tests[0].name, "test1");
  assert.notEqual(exercise.tests[1].name, "scenario2");
  assert.match(exercise.tests[0].name, /повертає|об'єкта/u);
  assert.match(exercise.tests[1].name, /повертає|null/u);
});
