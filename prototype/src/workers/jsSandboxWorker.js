import { buildSandboxErrorResult, executeSandboxRequest } from "../services/sandboxExecution.js";

self.addEventListener("message", async (event) => {
  try {
    const result = await executeSandboxRequest(event.data);
    self.postMessage(result);
  } catch (error) {
    const totalCount = Array.isArray(event.data?.tests) ? event.data.tests.length : 0;
    self.postMessage(
      buildSandboxErrorResult({
        totalCount,
        syntaxError: error.message
      })
    );
  }
});

self.addEventListener("messageerror", () => {
  self.postMessage(
    buildSandboxErrorResult({
      totalCount: 0,
      syntaxError: "Worker отримав повідомлення, яке не вдалося десеріалізувати."
    })
  );
});
