import { DEFAULT_TIMEOUT_MS } from "../core/constants.js";
import { formatValidationErrors, validateSandboxRequest } from "../core/contracts.js";
import { buildSandboxErrorResult } from "./sandboxExecution.js";

function createDefaultWorker() {
  return new Worker(new URL("../workers/jsSandboxWorker.js", import.meta.url), {
    type: "module"
  });
}

function nowMs() {
  return performance.now();
}

export function runExerciseTests({
  userCode,
  exercise,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  createWorker = createDefaultWorker,
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  now = nowMs
}) {
  const payload = {
    userCode,
    functionName: exercise?.functionName,
    tests: exercise?.tests
  };
  const totalCount = Array.isArray(exercise?.tests) ? exercise.tests.length : 0;
  const validation = validateSandboxRequest(payload);

  if (!validation.ok) {
    return Promise.resolve(
      buildSandboxErrorResult({
        totalCount,
        syntaxError: `Некоректні вхідні дані для sandbox: ${formatValidationErrors(validation)}`
      })
    );
  }

  return new Promise((resolve) => {
    let worker;
    let settled = false;
    let timerId = null;
    const startedAt = now();

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timerId !== null) {
        clearTimeoutFn(timerId);
      }

      if (worker) {
        try {
          worker.terminate();
        } catch (error) {
          console.error("[clientTestRunner] failed to terminate worker", error);
        }
      }

      resolve({
        ...result,
        durationMs: Math.round(now() - startedAt)
      });
    };

    try {
      worker = createWorker();
    } catch (error) {
      finish(
        buildSandboxErrorResult({
          totalCount,
          syntaxError: `Не вдалося створити sandbox worker: ${error.message}`
        })
      );
      return;
    }

    timerId = setTimeoutFn(() => {
      finish(
        buildSandboxErrorResult({
          status: "timeout",
          totalCount,
          syntaxError: `Перевищено ліміт ${timeoutMs} мс`
        })
      );
    }, timeoutMs);

    worker.addEventListener("message", (event) => {
      if (!event.data || typeof event.data !== "object") {
        finish(
          buildSandboxErrorResult({
            totalCount,
            syntaxError: "Sandbox повернув некоректну відповідь."
          })
        );
        return;
      }

      finish(event.data);
    });

    worker.addEventListener("error", (event) => {
      finish(
        buildSandboxErrorResult({
          totalCount,
          syntaxError: event.message || "Sandbox worker завершився з помилкою."
        })
      );
    });

    worker.addEventListener("messageerror", () => {
      finish(
        buildSandboxErrorResult({
          totalCount,
          syntaxError: "Помилка обміну повідомленнями з sandbox worker."
        })
      );
    });

    try {
      worker.postMessage(payload);
    } catch (error) {
      finish(
        buildSandboxErrorResult({
          totalCount,
          syntaxError: `Не вдалося передати дані в sandbox worker: ${error.message}`
        })
      );
    }
  });
}
