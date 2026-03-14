import test from "node:test";
import assert from "node:assert/strict";

import { extractJsonBlock } from "../src/core/json.js";

test("extractJsonBlock parses direct JSON", () => {
  const value = extractJsonBlock('{"ok":true,"count":2}');
  assert.deepEqual(value, { ok: true, count: 2 });
});

test("extractJsonBlock extracts JSON from wrapped text", () => {
  const value = extractJsonBlock('json output:\n{"title":"Task","tests":[1,2]}');
  assert.deepEqual(value, { title: "Task", tests: [1, 2] });
});
