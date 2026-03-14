import { DEFAULT_TIMEOUT_MS } from "../core/constants.js";

export function runExerciseTests({ userCode, exercise, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("../workers/jsSandboxWorker.js", import.meta.url), {
      type: "module"
    });
    const startedAt = performance.now();

    const timerId = window.setTimeout(() => {
      worker.terminate();
      resolve({
        status: "timeout",
        allPassed: false,
        passedCount: 0,
        totalCount: exercise.tests.length,
        failures: [],
        syntaxError: `Перевищено ліміт ${timeoutMs} мс`,
        durationMs: Math.round(performance.now() - startedAt)
      });
    }, timeoutMs);

    worker.addEventListener("message", (event) => {
      window.clearTimeout(timerId);
      worker.terminate();
      resolve({
        ...event.data,
        durationMs: Math.round(performance.now() - startedAt)
      });
    });

    worker.postMessage({
      userCode,
      functionName: exercise.functionName,
      tests: exercise.tests
    });
  });
}
