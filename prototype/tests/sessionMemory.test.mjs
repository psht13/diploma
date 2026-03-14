import test from "node:test";
import assert from "node:assert/strict";

import { SessionMemory } from "../src/state/sessionMemory.js";

const exercise = {
  title: "Demo exercise",
  topic: "Функції"
};

test("SessionMemory resets for exercise and stores tutor message", () => {
  const memory = new SessionMemory();
  memory.resetForExercise(exercise);

  assert.equal(memory.getUserState().currentTopic, "Функції");
  assert.equal(memory.getTranscript().length, 1);
});

test("SessionMemory records run result and increments attempts", () => {
  const memory = new SessionMemory();
  memory.resetForExercise(exercise);
  memory.recordRunResult({
    allPassed: false,
    syntaxError: null,
    failures: [{ name: "demo", expected: 1, actual: 0 }]
  });

  assert.equal(memory.getUserState().attemptsCount, 1);
  assert.equal(memory.getUserState().errorHistory[0].detail, "demo");
});
