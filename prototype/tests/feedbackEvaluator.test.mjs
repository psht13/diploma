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

test("FeedbackEvaluator uses a strict flat JSON prompt and deterministic generation settings", async () => {
  let capturedArgs = null;
  const evaluator = new FeedbackEvaluator({
    ollamaClient: {
      async generateJson(args) {
        capturedArgs = args;
        return {
          data: {
            summary: "Усі тести пройдено.",
            nextStep: "Коротко поясніть алгоритм.",
            tutorStyle: "celebration",
            revealLevel: "none"
          },
          meta: { source: "ollama" }
        };
      }
    }
  });

  await evaluator.evaluate({
    exercise,
    runResult: { ...runResult, allPassed: true, failures: [] },
    userState,
    policy: { action: "celebrate_and_reflect" },
    studentRequest: ""
  });

  assert.ok(capturedArgs);
  assert.equal(capturedArgs.temperature, 0);
  assert.equal(capturedArgs.maxRetries, 0);
  assert.match(capturedArgs.prompt, /Заборонено повертати ключі exercise, runResult, userState, policy, studentRequest/u);
  assert.match(capturedArgs.prompt, /обов'язково назви перший провалений сценарій/u);
  assert.match(capturedArgs.prompt, /обов'язково скажи, що очікувалося і що фактично отримано/u);
  assert.match(capturedArgs.prompt, /Контекст вправи:/u);
  assert.match(capturedArgs.prompt, /Поверни відповідь точно в такій формі:/u);
});

test("FeedbackEvaluator preserves fallback reason for UI diagnostics", async () => {
  const evaluator = new FeedbackEvaluator({
    ollamaClient: {
      async generateJson({ fallback }) {
        return {
          data: fallback,
          meta: {
            source: "fallback",
            reason: "Schema mismatch: summary must be a non-empty string"
          }
        };
      }
    }
  });

  const feedback = await evaluator.evaluate({
    exercise,
    runResult,
    userState,
    policy: { action: "minimal_hint" },
    studentRequest: ""
  });

  assert.equal(feedback.source, "fallback");
  assert.match(feedback.reason, /Schema mismatch/u);
});

test("FeedbackEvaluator replaces generic failing feedback with a concrete hint", async () => {
  const evaluator = new FeedbackEvaluator({
    ollamaClient: {
      async generateJson() {
        return {
          data: {
            summary: "Навчайся працювати зі змінними об'єктами.",
            nextStep: "Повтори test2.",
            tutorStyle: "minimal",
            revealLevel: "low"
          },
          meta: { source: "ollama" }
        };
      }
    }
  });

  const feedback = await evaluator.evaluate({
    exercise: {
      title: "Пошук ключа з найбільшою кількістю значень",
      topic: "Об'єкти",
      functionName: "mostValuesKey",
      concepts: ["об'єкти", "цикли"]
    },
    runResult: {
      allPassed: false,
      syntaxError: null,
      failures: [
        {
          name: "повертає ключ з найбільшою кількістю значень",
          expected: "a",
          actual: null,
          args: [{ a: [1, 2], b: [3] }]
        }
      ]
    },
    userState,
    policy: { action: "minimal_hint" },
    studentRequest: ""
  });

  assert.equal(feedback.source, "ollama");
  assert.match(feedback.summary, /очікувалося|отримано|повертає ключ/u);
  assert.match(feedback.nextStep, /сценарій|об'єкта|ключ/u);
  assert.doesNotMatch(feedback.nextStep, /test2|навчайся/u);
});
