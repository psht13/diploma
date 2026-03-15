import test from "node:test";
import assert from "node:assert/strict";

import { executeSandboxRequest } from "../src/services/sandboxExecution.js";

const tests = [{ name: "порожній масив", args: [[]], expected: 0 }];

test("executeSandboxRequest reports missing function", async () => {
  const result = await executeSandboxRequest({
    userCode: "function anotherName(numbers) { return numbers.length; }",
    functionName: "sumArray",
    tests
  });

  assert.equal(result.status, "error");
  assert.match(result.syntaxError, /Не знайдено функцію sumArray/u);
  assert.equal(result.failures[0].name, "missing-function");
});

test("executeSandboxRequest rejects invalid functionName before code interpolation", async () => {
  const result = await executeSandboxRequest({
    userCode: "function sumArray(numbers) { return numbers.length; }",
    functionName: "sumArray;globalThis.hacked=1",
    tests
  });

  assert.equal(result.status, "error");
  assert.match(result.syntaxError, /functionName must be a valid JavaScript identifier/u);
});
