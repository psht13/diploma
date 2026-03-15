export function buildRunErrorSignature(runResult) {
  if (!runResult) {
    return null;
  }

  if (runResult.syntaxError) {
    return `syntax:${runResult.syntaxError}`;
  }

  const firstFailure = runResult.failures?.[0];

  if (!firstFailure) {
    return null;
  }

  return `test:${firstFailure.name}:${JSON.stringify(firstFailure.expected)}`;
}
