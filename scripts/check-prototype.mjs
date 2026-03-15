import assert from "node:assert/strict";

import { decideTutorAction } from "../prototype/src/services/tutorPolicy.js";
import { SessionMemory } from "../prototype/src/state/sessionMemory.js";

const explainPolicy = decideTutorAction({
  userState: { attemptsCount: 2, errorHistory: [] },
  runResult: {
    status: "failed",
    allPassed: false,
    syntaxError: null,
    failures: [{ name: "demo", expected: 1, actual: 0 }]
  },
  studentRequest: "Потрібна підказка",
  interactionMode: "explain"
});

assert.equal(
  explainPolicy.action,
  "concept_explanation",
  "interactionMode=explain must force concept_explanation"
);

const memory = new SessionMemory();
memory.resetForExercise({
  title: "Demo exercise",
  topic: "Функції",
  difficulty: "basic"
});
memory.recordRunResult({
  status: "failed",
  allPassed: false,
  passedCount: 0,
  totalCount: 1,
  syntaxError: null,
  failures: [{ name: "demo", expected: 1, actual: 0 }]
});
memory.noteTutorAction("concept_explanation");

const exported = memory.buildSessionExport({
  timestamp: "2026-03-15T10:00:00.000Z"
});

assert.equal(exported.topic, "Функції");
assert.equal(exported.difficulty, "basic");
assert.equal(exported.firstFailure.detail, "demo");
assert.equal(exported.lastAction, "concept_explanation");

console.log("Prototype checks passed.");
