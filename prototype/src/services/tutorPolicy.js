import { buildRunErrorSignature } from "../core/runResult.js";

function isExplanationRequest(studentRequest = "") {
  return /поясн|чому|як працює|explain/i.test(studentRequest);
}

export function decideTutorAction({ userState, runResult, studentRequest = "" }) {
  if (isExplanationRequest(studentRequest)) {
    return {
      action: "concept_explanation",
      hintLevel: "conceptual",
      rationale: "Користувач явно попросив пояснення."
    };
  }

  if (runResult?.allPassed) {
    return {
      action: "celebrate_and_reflect",
      hintLevel: "none",
      rationale: "Усі тести пройдено."
    };
  }

  if (runResult?.syntaxError) {
    return {
      action: "syntax_repair",
      hintLevel: "minimal",
      rationale: "Виявлено синтаксичну помилку."
    };
  }

  const attemptsCount = userState?.attemptsCount ?? 0;
  const currentSignature = buildRunErrorSignature(runResult);
  const latestHistoryEntry = userState?.errorHistory?.[0] ?? null;
  const previousHistoryEntry =
    latestHistoryEntry?.signature === currentSignature ? userState?.errorHistory?.[1] : latestHistoryEntry;
  const repeatedError =
    Boolean(currentSignature) && previousHistoryEntry?.signature === currentSignature;

  if (repeatedError || attemptsCount >= 3) {
    return {
      action: "targeted_hint",
      hintLevel: "targeted",
      rationale: repeatedError
        ? "Помилка повторюється, тому можна дати точнішу підказку."
        : "Це вже щонайменше третя невдала спроба."
    };
  }

  return {
    action: "minimal_hint",
    hintLevel: "minimal",
    rationale: "Потрібно підштовхнути студента без готового розв'язку."
  };
}
