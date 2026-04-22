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

test("OllamaClient getStatus requires an exact tagged model match", async () => {
  const originalFetch = global.fetch;
  let phase = 0;

  global.fetch = async () => {
    phase += 1;

    return {
      ok: true,
      async json() {
        return phase === 1
          ? { models: [{ name: "llama3.1:8b-instruct" }] }
          : { models: [{ name: "llama3.1:8b" }] };
      }
    };
  };

  try {
    const client = new OllamaClient({
      baseUrl: "http://example.test",
      model: "llama3.1:8b"
    });

    const mismatched = await client.getStatus();
    const exact = await client.getStatus();

    assert.equal(mismatched.available, true);
    assert.equal(mismatched.hasTargetModel, false);
    assert.match(mismatched.message, /не знайдена/u);

    assert.equal(exact.available, true);
    assert.equal(exact.hasTargetModel, true);
    assert.match(exact.message, /доступна/u);
  } finally {
    global.fetch = originalFetch;
  }
});
