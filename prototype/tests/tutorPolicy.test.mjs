import test from "node:test";
import assert from "node:assert/strict";

import { decideTutorAction } from "../src/services/tutorPolicy.js";

test("TutorPolicy prioritizes explanation requests", () => {
  const policy = decideTutorAction({
    userState: { attemptsCount: 0, errorHistory: [] },
    runResult: null,
    studentRequest: "Поясни, як це працює"
  });

  assert.equal(policy.action, "concept_explanation");
});

test("TutorPolicy escalates after repeated attempts", () => {
  const policy = decideTutorAction({
    userState: { attemptsCount: 2, errorHistory: [{ detail: "тест 1" }] },
    runResult: { allPassed: false, syntaxError: null, failures: [{ name: "тест 2" }] },
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
