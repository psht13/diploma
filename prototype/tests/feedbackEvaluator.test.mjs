import test from "node:test";
import assert from "node:assert/strict";

import { FeedbackEvaluator } from "../src/services/feedbackEvaluator.js";

const exercise = {
  title: "Сума елементів масиву",
  topic: "Функції",
  functionName: "sumArray",
  concepts: ["масиви", "цикли", "повернення значення"]
};

const userState = {
  attemptsCount: 1,
  errorHistory: [{ detail: "порожній масив" }]
};

const runResult = {
  allPassed: false,
  syntaxError: null,
  failures: [{ name: "порожній масив", expected: 0, actual: undefined }]
};

test("FeedbackEvaluator fallback explanation explains the concept instead of repeating the request", async () => {
  const evaluator = new FeedbackEvaluator({
    ollamaClient: {
      async generateJson({ fallback }) {
        return {
          data: fallback,
          meta: { source: "fallback" }
        };
      }
    }
  });

  const studentRequest = "Поясни, як це працює";
  const feedback = await evaluator.evaluate({
    exercise,
    runResult,
    userState,
    policy: { action: "concept_explanation" },
    studentRequest
  });

  assert.notEqual(feedback.summary, studentRequest);
  assert.match(feedback.summary, /контракт функції|значення повертає|сценарію/u);
  assert.equal(feedback.source, "fallback");
});
