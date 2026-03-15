import test from "node:test";
import assert from "node:assert/strict";

import { decideTutorAction } from "../src/services/tutorPolicy.js";
import { SessionMemory } from "../src/state/sessionMemory.js";

const exercise = {
  title: "Demo exercise",
  topic: "Функції"
};

function buildFailedRunResult(name = "тест 1") {
  return {
    allPassed: false,
    syntaxError: null,
    failures: [{ name, expected: 1, actual: 0 }]
  };
}

test("TutorPolicy prioritizes explanation requests from natural language", () => {
  const policy = decideTutorAction({
    userState: { attemptsCount: 0, errorHistory: [] },
    runResult: null,
    studentRequest: "Поясни, як це працює"
  });

  assert.equal(policy.action, "concept_explanation");
});

test("TutorPolicy respects explicit explain interaction mode even without explanation keywords", () => {
  const policy = decideTutorAction({
    userState: { attemptsCount: 2, errorHistory: [] },
    runResult: buildFailedRunResult("помилка"),
    studentRequest: "Що робити далі?",
    interactionMode: "explain"
  });

  assert.equal(policy.action, "concept_explanation");
});

test("TutorPolicy keeps the first recorded failure at minimal_hint", () => {
  const memory = new SessionMemory();
  memory.resetForExercise(exercise);
  memory.recordRunResult(buildFailedRunResult("повторюваний тест"));

  const policy = decideTutorAction({
    userState: memory.getUserState(),
    runResult: memory.getLastRunResult(),
    studentRequest: ""
  });

  assert.equal(policy.action, "minimal_hint");
});

test("TutorPolicy escalates to targeted_hint for the same repeated error", () => {
  const memory = new SessionMemory();
  memory.resetForExercise(exercise);
  memory.recordRunResult(buildFailedRunResult("повторюваний тест"));
  memory.recordRunResult(buildFailedRunResult("повторюваний тест"));

  const policy = decideTutorAction({
    userState: memory.getUserState(),
    runResult: memory.getLastRunResult(),
    studentRequest: ""
  });

  assert.equal(policy.action, "targeted_hint");
});

test("TutorPolicy escalates after a third failed attempt even with different errors", () => {
  const memory = new SessionMemory();
  memory.resetForExercise(exercise);
  memory.recordRunResult(buildFailedRunResult("тест 1"));
  memory.recordRunResult(buildFailedRunResult("тест 2"));
  memory.recordRunResult(buildFailedRunResult("тест 3"));

  const policy = decideTutorAction({
    userState: memory.getUserState(),
    runResult: memory.getLastRunResult(),
    studentRequest: ""
  });

  assert.equal(policy.action, "targeted_hint");
});

test("TutorPolicy celebrates passed tests", () => {
  const policy = decideTutorAction({
    userState: { attemptsCount: 1, errorHistory: [] },
    runResult: { allPassed: true, failures: [] },
    studentRequest: ""
  });

  assert.equal(policy.action, "celebrate_and_reflect");
});
