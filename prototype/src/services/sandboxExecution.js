import { formatValidationErrors, validateSandboxRequest } from "../core/contracts.js";

const BLOCKED_GLOBAL_NAMES = [
  "self",
  "globalThis",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "Worker",
  "SharedWorker",
  "importScripts",
  "navigator",
  "location",
  "caches",
  "indexedDB",
  "postMessage",
  "close"
];

function toComparableValue(value) {
  if (typeof value === "undefined") {
    return "__undefined__";
  }

  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(toComparableValue(left)) === JSON.stringify(toComparableValue(right));
}

function buildFunctionFromCode(userCode, functionName) {
  const factory = new Function(
    ...BLOCKED_GLOBAL_NAMES,
    `"use strict";\n${userCode}\nreturn typeof ${functionName} !== "undefined" ? ${functionName} : undefined;`
  );

  return factory(...Array(BLOCKED_GLOBAL_NAMES.length).fill(undefined));
}

export function buildSandboxErrorResult({
  status = "error",
  totalCount = 0,
  syntaxError,
  failures = []
}) {
  return {
    status,
    allPassed: false,
    passedCount: 0,
    totalCount,
    failures,
    syntaxError: syntaxError || "Невідома помилка sandbox"
  };
}

export async function executeSandboxRequest(payload) {
  const totalCount = Array.isArray(payload?.tests) ? payload.tests.length : 0;
  const validation = validateSandboxRequest(payload);

  if (!validation.ok) {
    return buildSandboxErrorResult({
      totalCount,
      syntaxError: `Некоректний sandbox payload: ${formatValidationErrors(validation)}`
    });
  }

  const { userCode, functionName, tests } = payload;

  try {
    const candidate = buildFunctionFromCode(userCode, functionName);

    if (typeof candidate !== "function") {
      return buildSandboxErrorResult({
        totalCount,
        syntaxError: `Не знайдено функцію ${functionName}`,
        failures: [
          {
            name: "missing-function",
            expected: `function ${functionName}`,
            actual: typeof candidate
          }
        ]
      });
    }

    const failures = [];
    let passedCount = 0;

    for (const testCase of tests) {
      try {
        const actual = await candidate(...testCase.args);
        const passed = valuesEqual(actual, testCase.expected);

        if (passed) {
          passedCount += 1;
        } else {
          failures.push({
            name: testCase.name,
            expected: testCase.expected,
            actual
          });
        }
      } catch (error) {
        failures.push({
          name: testCase.name,
          expected: testCase.expected,
          actual: error.message,
          runtimeError: true
        });
      }
    }

    return {
      status: failures.length ? "failed" : "passed",
      allPassed: failures.length === 0,
      passedCount,
      totalCount,
      failures,
      syntaxError: null
    };
  } catch (error) {
    return buildSandboxErrorResult({
      totalCount,
      syntaxError: error.message
    });
  }
}
