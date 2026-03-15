import test from "node:test";
import assert from "node:assert/strict";

import { validateFeedbackPayload } from "../src/core/contracts.js";
import { OllamaClient } from "../src/services/ollamaClient.js";

const fallbackFeedback = {
  summary: "fallback summary",
  nextStep: "fallback next step",
  tutorStyle: "minimal",
  revealLevel: "low"
};

test("OllamaClient retries after schema mismatch and returns a valid later response", async () => {
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    if (calls === 1) {
      return {
        ok: true,
        async json() {
          return { response: "null" };
        }
      };
    }

    return {
      ok: true,
      async json() {
        return {
          response:
            '{"summary":"Видно, де саме зламався тест.","nextStep":"Перевір умову.","tutorStyle":"targeted","revealLevel":"medium"}'
        };
      }
    };
  };

  try {
    const client = new OllamaClient({
      baseUrl: "http://example.test",
      model: "demo-model"
    });
    const result = await client.generateJson({
      prompt: "demo",
      fallback: fallbackFeedback,
      validate: validateFeedbackPayload,
      maxRetries: 1
    });

    assert.equal(calls, 2);
    assert.equal(result.meta.source, "ollama");
    assert.equal(result.meta.attempts, 2);
    assert.equal(result.data.tutorStyle, "targeted");
  } finally {
    global.fetch = originalFetch;
  }
});

test("OllamaClient returns fallback after repeated schema mismatch", async () => {
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return {
          response: '{"summary":"partial only"}'
        };
      }
    };
  };

  try {
    const client = new OllamaClient({
      baseUrl: "http://example.test",
      model: "demo-model"
    });
    const result = await client.generateJson({
      prompt: "demo",
      fallback: fallbackFeedback,
      validate: validateFeedbackPayload,
      maxRetries: 1
    });

    assert.equal(calls, 2);
    assert.equal(result.meta.source, "fallback");
    assert.match(result.meta.reason, /Schema mismatch/u);
    assert.deepEqual(result.data, fallbackFeedback);
  } finally {
    global.fetch = originalFetch;
  }
});
