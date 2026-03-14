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
  const previousError = userState?.errorHistory?.[0]?.detail;
  const currentError = runResult?.failures?.[0]?.name;
  const repeatedError = previousError && currentError && previousError === currentError;

  if (repeatedError || attemptsCount >= 2) {
    return {
      action: "targeted_hint",
      hintLevel: "targeted",
      rationale: "Помилка повторюється або це не перша спроба."
    };
  }

  return {
    action: "minimal_hint",
    hintLevel: "minimal",
    rationale: "Потрібно підштовхнути студента без готового розв'язку."
  };
}
