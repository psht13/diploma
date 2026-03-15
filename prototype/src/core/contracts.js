const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const FEEDBACK_STYLES = new Set([
  "minimal",
  "targeted",
  "conceptual",
  "celebration",
  "syntax"
]);

const REVEAL_LEVELS = new Set(["none", "low", "medium"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function validateTestCase(value, index, prefix = "tests") {
  const errors = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: [`${prefix}[${index}] must be an object`]
    };
  }

  if (!isNonEmptyString(value.name)) {
    errors.push(`${prefix}[${index}].name must be a non-empty string`);
  }

  if (!Array.isArray(value.args)) {
    errors.push(`${prefix}[${index}].args must be an array`);
  }

  if (!hasOwn(value, "expected")) {
    errors.push(`${prefix}[${index}].expected must be present`);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateFunctionName(value) {
  return isNonEmptyString(value) && IDENTIFIER_PATTERN.test(value.trim());
}

export function validateExercisePayload(value) {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: ["exercise payload must be a JSON object"]
    };
  }

  const errors = [];

  for (const field of ["id", "topic", "title", "prompt", "starterCode"]) {
    if (!isNonEmptyString(value[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (!validateFunctionName(value.functionName)) {
    errors.push("functionName must be a valid JavaScript identifier");
  }

  if (!isStringArray(value.concepts)) {
    errors.push("concepts must be a non-empty string array");
  }

  if (!isStringArray(value.rubric)) {
    errors.push("rubric must be a non-empty string array");
  }

  if (!Array.isArray(value.tests) || value.tests.length === 0) {
    errors.push("tests must be a non-empty array");
  } else {
    for (const [index, testCase] of value.tests.entries()) {
      const result = validateTestCase(testCase, index);
      errors.push(...result.errors);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateFeedbackPayload(value) {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: ["feedback payload must be a JSON object"]
    };
  }

  const errors = [];

  if (!isNonEmptyString(value.summary)) {
    errors.push("summary must be a non-empty string");
  }

  if (!isNonEmptyString(value.nextStep)) {
    errors.push("nextStep must be a non-empty string");
  }

  if (!isNonEmptyString(value.tutorStyle) || !FEEDBACK_STYLES.has(value.tutorStyle)) {
    errors.push("tutorStyle must be one of: minimal, targeted, conceptual, celebration, syntax");
  }

  if (!isNonEmptyString(value.revealLevel) || !REVEAL_LEVELS.has(value.revealLevel)) {
    errors.push("revealLevel must be one of: none, low, medium");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateSandboxRequest(value) {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: ["sandbox payload must be an object"]
    };
  }

  const errors = [];

  if (typeof value.userCode !== "string") {
    errors.push("userCode must be a string");
  }

  if (!validateFunctionName(value.functionName)) {
    errors.push("functionName must be a valid JavaScript identifier");
  }

  if (!Array.isArray(value.tests) || value.tests.length === 0) {
    errors.push("tests must be a non-empty array");
  } else {
    for (const [index, testCase] of value.tests.entries()) {
      const result = validateTestCase(testCase, index, "tests");
      errors.push(...result.errors);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function formatValidationErrors(result) {
  return result.errors.join("; ");
}
