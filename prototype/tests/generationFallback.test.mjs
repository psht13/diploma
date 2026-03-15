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
