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

test("SessionMemory builds lightweight session export for experiments", () => {
  const memory = new SessionMemory();
  memory.resetForExercise({
    ...exercise,
    difficulty: "basic"
  });
  memory.addStudentMessage("Моя перша спроба");
  memory.recordRunResult({
    status: "failed",
    allPassed: false,
    passedCount: 1,
    totalCount: 2,
    syntaxError: null,
    failures: [{ name: "demo", expected: 1, actual: 0 }]
  });
  memory.noteTutorAction("concept_explanation");

  const exported = memory.buildSessionExport({
    timestamp: "2026-03-15T10:00:00.000Z"
  });

  assert.deepEqual(Object.keys(exported), [
    "topic",
    "difficulty",
    "attemptsCount",
    "firstFailure",
    "lastAction",
    "transcript",
    "finalRunStatus",
    "timestamp"
  ]);
  assert.equal(exported.topic, "Функції");
  assert.equal(exported.difficulty, "basic");
  assert.equal(exported.attemptsCount, 1);
  assert.equal(exported.firstFailure.detail, "demo");
  assert.equal(exported.lastAction, "concept_explanation");
  assert.equal(exported.finalRunStatus.status, "failed");
  assert.equal(exported.timestamp, "2026-03-15T10:00:00.000Z");
});

test("SessionMemory clears firstFailure when a new exercise starts", () => {
  const memory = new SessionMemory();
  memory.resetForExercise({
    ...exercise,
    difficulty: "basic"
  });
  memory.recordRunResult({
    status: "failed",
    allPassed: false,
    passedCount: 0,
    totalCount: 1,
    syntaxError: "demo syntax error",
    failures: []
  });

  memory.resetForExercise({
    title: "New exercise",
    topic: "Масиви",
    difficulty: "basic-plus"
  });

  const exported = memory.buildSessionExport({
    timestamp: "2026-03-15T11:00:00.000Z"
  });

  assert.equal(exported.topic, "Масиви");
  assert.equal(exported.attemptsCount, 0);
  assert.equal(exported.firstFailure, null);
  assert.equal(exported.finalRunStatus, null);
});
