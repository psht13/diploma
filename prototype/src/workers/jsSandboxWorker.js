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
    `"use strict";\n${userCode}\nreturn typeof ${functionName} !== "undefined" ? ${functionName} : undefined;`
  );

  return factory();
}

self.addEventListener("message", async (event) => {
  const { userCode, functionName, tests } = event.data;

  try {
    const candidate = buildFunctionFromCode(userCode, functionName);

    if (typeof candidate !== "function") {
      self.postMessage({
        status: "error",
        allPassed: false,
        passedCount: 0,
        totalCount: tests.length,
        failures: [
          {
            name: "missing-function",
            expected: `function ${functionName}`,
            actual: typeof candidate
          }
        ],
        syntaxError: `Не знайдено функцію ${functionName}`
      });
      return;
    }

    const failures = [];
    let passedCount = 0;

    for (const test of tests) {
      try {
        const actual = await candidate(...test.args);
        const passed = valuesEqual(actual, test.expected);

        if (passed) {
          passedCount += 1;
        } else {
          failures.push({
            name: test.name,
            expected: test.expected,
            actual
          });
        }
      } catch (error) {
        failures.push({
          name: test.name,
          expected: test.expected,
          actual: error.message,
          runtimeError: true
        });
      }
    }

    self.postMessage({
      status: failures.length ? "failed" : "passed",
      allPassed: failures.length === 0,
      passedCount,
      totalCount: tests.length,
      failures,
      syntaxError: null
    });
  } catch (error) {
    self.postMessage({
      status: "error",
      allPassed: false,
      passedCount: 0,
      totalCount: tests.length,
      failures: [],
      syntaxError: error.message
    });
  }
});
