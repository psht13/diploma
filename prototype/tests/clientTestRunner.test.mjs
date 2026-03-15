import test from "node:test";
import assert from "node:assert/strict";

import { runExerciseTests } from "../src/services/clientTestRunner.js";

class FakeWorker {
  constructor() {
    this.listeners = new Map();
    this.terminated = false;
  }

  addEventListener(type, handler) {
    const existing = this.listeners.get(type) || [];
    existing.push(handler);
    this.listeners.set(type, existing);
  }

  terminate() {
    this.terminated = true;
  }

  postMessage() {}
}

test("runExerciseTests returns timeout result when worker does not respond", async () => {
  const worker = new FakeWorker();
  let timeoutCallback = null;
  let timeoutMs = null;

  const resultPromise = runExerciseTests({
    userCode: "function sumArray(numbers) { while (true) {} }",
    exercise: {
      functionName: "sumArray",
      tests: [{ name: "demo", args: [[]], expected: 0 }]
    },
    timeoutMs: 25,
    createWorker: () => worker,
    setTimeoutFn: (callback, delay) => {
      timeoutCallback = callback;
      timeoutMs = delay;
      return 1;
    },
    clearTimeoutFn: () => {},
    now: () => 0
  });

  timeoutCallback();

  const result = await resultPromise;

  assert.equal(timeoutMs, 25);
  assert.equal(result.status, "timeout");
  assert.match(result.syntaxError, /25/u);
  assert.equal(worker.terminated, true);
});

test("runExerciseTests validates functionName before creating a worker", async () => {
  let workerCreated = false;

  const result = await runExerciseTests({
    userCode: "function sumArray(numbers) { return numbers.length; }",
    exercise: {
      functionName: "sumArray-bad",
      tests: [{ name: "demo", args: [[]], expected: 0 }]
    },
    createWorker: () => {
      workerCreated = true;
      return new FakeWorker();
    },
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    now: () => 0
  });

  assert.equal(workerCreated, false);
  assert.equal(result.status, "error");
  assert.match(result.syntaxError, /functionName must be a valid JavaScript identifier/u);
});
