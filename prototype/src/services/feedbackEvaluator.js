import { validateFeedbackPayload } from "../core/contracts.js";

function formatReadableValue(value) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return `«${value}»`;
  }

  return JSON.stringify(value);
}

function formatFailure(failure) {
  if (!failure) {
    return "Точковий збій ще не визначено.";
  }

  const actualValue = formatReadableValue(failure.actual);
  const expectedValue = formatReadableValue(failure.expected);

  return `Тест «${failure.name}» не пройдено: очікувалося ${expectedValue}, отримано ${actualValue}.`;
}

function buildConceptExplanation({ exercise, runResult }) {
  const functionName = exercise?.functionName || "потрібна функція";
  const concepts = Array.isArray(exercise?.concepts) ? exercise.concepts.slice(0, 3) : [];
  const conceptsText = concepts.length ? concepts.join(", ") : "базові операції JavaScript";
  const failureName = runResult?.failures?.[0]?.name;
  const failureFocus = failureName
    ? ` Почніть зі сценарію «${failureName}» і перевірте, яке значення функція має повернути саме там.`
    : "";

  return `У цій вправі важливо спочатку визначити контракт функції ${functionName}: які аргументи вона отримує, як опрацьовує дані через ${conceptsText} і яке значення повертає.${failureFocus}`;
}

function formatPromptValue(value, fallback = "none") {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : fallback;
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function describeFailureInput(failure) {
  if (!failure || !Array.isArray(failure.args) || failure.args.length === 0) {
    return "цього прикладу";
  }

  if (failure.args.length === 1) {
    const [value] = failure.args;

    if (Array.isArray(value)) {
      return `масиву ${formatReadableValue(value)}`;
    }

    if (value && typeof value === "object") {
      return `об'єкта ${formatReadableValue(value)}`;
    }

    return `значення ${formatReadableValue(value)}`;
  }

  return `аргументів ${formatReadableValue(failure.args)}`;
}

function inferLogicFocus({ exercise, failure }) {
  const firstArg = failure?.args?.[0];

  if (firstArg && typeof firstArg === "object" && !Array.isArray(firstArg)) {
    return "Перевірте, чи ви проходите всі ключі об'єкта і для кожного ключа правильно рахуєте кількість значень.";
  }

  if (Array.isArray(firstArg)) {
    return "Перевірте, чи ви проходите всі елементи масиву і оновлюєте результат на кожній ітерації, а не лише в одному випадку.";
  }

  if (typeof firstArg === "string") {
    return "Перевірте, чи ви читаєте потрібний рядок або символ і повертаєте значення саме для цього сценарію.";
  }

  if (typeof firstArg === "number") {
    return "Перевірте, чи обчислення для цього числа взагалі доходить до return і не зупиняється на null або undefined.";
  }

  const concepts = Array.isArray(exercise?.concepts) ? exercise.concepts.slice(0, 2) : [];
  if (concepts.length) {
    return `Зосередьтеся на логіці, пов'язаній з поняттями ${concepts.join(" та ")}.`;
  }

  return "Перевірте саме ту гілку логіки, яка обробляє цей сценарій.";
}

function buildConcreteNextStep({ exercise, runResult }) {
  const failure = runResult?.failures?.[0];

  if (!failure) {
    return "Звірте поточний код із найпростішим прикладом. Після цього ще раз запустіть тести й перевірте, що повертає функція.";
  }

  return `Спочатку окремо програйте сценарій «${failure.name}»: для ${describeFailureInput(failure)} функція має повернути ${formatReadableValue(failure.expected)}, а зараз повертає ${formatReadableValue(failure.actual)}. ${inferLogicFocus({
    exercise,
    failure
  })}`;
}

function buildTargetedNextStep({ exercise, runResult }) {
  const failure = runResult?.failures?.[0];

  if (!failure) {
    return "Розкладіть алгоритм на два кроки: що ви читаєте з вхідних даних і що саме повертаєте. Потім перевірте, де результат втрачається.";
  }

  return `У сценарії «${failure.name}» збій уже локалізований: для ${describeFailureInput(failure)} потрібно отримати ${formatReadableValue(failure.expected)}, а не ${formatReadableValue(failure.actual)}. Перевірте саме той фрагмент логіки, який обробляє цей тип даних, і звірте проміжне значення перед return.`;
}

function normalizeTextToken(text) {
  return String(text ?? "")
    .toLowerCase()
    .replaceAll(/[«»"'`]/g, "")
    .trim();
}

function includesFailureReference(text, failure) {
  if (!failure) {
    return true;
  }

  const normalizedText = normalizeTextToken(text);
  const candidates = [
    failure.name,
    formatReadableValue(failure.expected),
    formatReadableValue(failure.actual)
  ]
    .filter(Boolean)
    .map((value) => normalizeTextToken(value));

  return candidates.some((candidate) => candidate && normalizedText.includes(candidate));
}

function isOverlyGenericFeedbackText(text) {
  const normalizedText = normalizeTextToken(text);

  if (!normalizedText) {
    return true;
  }

  return [
    /повтори\s+(test|тест)\s*\d+/u,
    /test\d+/u,
    /навчайся/u,
    /працюй\s+з/u,
    /попрацюй\s+з/u
  ].some((pattern) => pattern.test(normalizedText));
}

function coerceFeedbackSpecificity(raw, fallback, runResult, policy) {
  if (
    !runResult?.failures?.length ||
    runResult?.allPassed ||
    runResult?.syntaxError ||
    policy?.action === "concept_explanation"
  ) {
    return raw;
  }

  const failure = runResult.failures[0];

  return {
    ...raw,
    summary:
      includesFailureReference(raw.summary, failure) && !isOverlyGenericFeedbackText(raw.summary)
        ? raw.summary
        : fallback.summary,
    nextStep:
      includesFailureReference(raw.nextStep, failure) && !isOverlyGenericFeedbackText(raw.nextStep)
        ? raw.nextStep
        : fallback.nextStep
  };
}

function buildFallbackFeedback({ exercise, runResult, userState, policy, studentRequest }) {
  if (policy.action === "concept_explanation") {
    return {
      summary: buildConceptExplanation({ exercise, runResult }),
      nextStep:
        "Спробуйте власними словами сформулювати алгоритм у 2-3 кроках, а потім перенесіть його в код.",
      tutorStyle: "conceptual",
      revealLevel: "low"
    };
  }

  if (runResult?.allPassed) {
    return {
      summary: "Усі тести пройдено. Рішення працює для перевірених сценаріїв.",
      nextStep:
        "Не переходьте далі автоматично: коротко поясніть, чому функція дає правильний результат. Це закріплює розуміння.",
      tutorStyle: "celebration",
      revealLevel: "none"
    };
  }

  if (runResult?.syntaxError) {
    return {
      summary: `Є синтаксична помилка: ${runResult.syntaxError}.`,
      nextStep:
        "Перевірте дужки, фігурні дужки та ключове слово return. Репетитор не дає готовий код, але підказує місце пошуку проблеми.",
      tutorStyle: "syntax",
      revealLevel: "low"
    };
  }

  if (policy.action === "targeted_hint") {
    return {
      summary: formatFailure(runResult?.failures?.[0]),
      nextStep: buildTargetedNextStep({ exercise, runResult }),
      tutorStyle: "targeted",
      revealLevel: "medium"
    };
  }

  return {
    summary: formatFailure(runResult?.failures?.[0]),
    nextStep: buildConcreteNextStep({ exercise, runResult }),
    tutorStyle: "minimal",
    revealLevel: "low"
  };
}

function buildFeedbackPrompt({ exercise, runResult, userState, policy, studentRequest, fallback }) {
  const firstFailure = runResult?.failures?.[0]
    ? formatFailure(runResult.failures[0])
    : "none";
  const recentErrors =
    Array.isArray(userState?.errorHistory) && userState.errorHistory.length
      ? userState.errorHistory
          .map((entry) => entry?.detail)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ")
      : "none";

  return `
Ти - доброзичливий репетитор з JavaScript для початківця.
Поверни тільки один JSON-об'єкт і не додавай жодних інших ключів.

Дозволені ключі відповіді:
- summary
- nextStep
- tutorStyle
- revealLevel

Заборонено повертати ключі exercise, runResult, userState, policy, studentRequest.

Правила:
- не давай повний розв'язок;
- не вставляй завершену функцію;
- якщо є збій тесту, обов'язково назви перший провалений сценарій;
- якщо є збій тесту, обов'язково скажи, що очікувалося і що фактично отримано;
- summary має бути 1-2 конкретними реченнями українською;
- nextStep має бути рівно 2 конкретними реченнями українською;
- tutorStyle має бути одним із: minimal, targeted, conceptual, celebration, syntax;
- revealLevel має бути одним із: none, low, medium.
- не використовуй загальні фрази на кшталт «попрацюй з об'єктами», «повтори test2» або «ще раз спробуй» без пояснення, що саме перевірити.

Контекст вправи:
- title: ${formatPromptValue(exercise?.title)}
- topic: ${formatPromptValue(exercise?.topic)}
- functionName: ${formatPromptValue(exercise?.functionName)}
- concepts: ${formatPromptValue(exercise?.concepts)}

Контекст результату:
- allPassed: ${formatPromptValue(runResult?.allPassed)}
- passedCount: ${formatPromptValue(runResult?.passedCount)}
- totalCount: ${formatPromptValue(runResult?.totalCount)}
- syntaxError: ${runResult?.syntaxError ?? "null"}
- firstFailure: ${firstFailure}

Контекст студента:
- attemptsCount: ${formatPromptValue(userState?.attemptsCount)}
- recentErrors: ${recentErrors}
- confidence: ${formatPromptValue(userState?.confidence)}
- knowledgeLevel: ${formatPromptValue(userState?.knowledgeLevel)}
- lastAction: ${formatPromptValue(userState?.lastAction)}

Контекст політики:
- policy.action: ${formatPromptValue(policy?.action)}
- studentRequest: ${formatPromptValue(studentRequest, "empty")}

Поверни відповідь точно в такій формі:
{
  "summary": "короткий рядок",
  "nextStep": "короткий рядок",
  "tutorStyle": "${fallback.tutorStyle}",
  "revealLevel": "${fallback.revealLevel}"
}
`.trim();
}

function normalizeFeedback(raw, fallback, meta) {
  const normalizedSourceMeta = meta ?? { source: "fallback" };
  return {
    summary: typeof raw.summary === "string" ? raw.summary : fallback.summary,
    nextStep: typeof raw.nextStep === "string" ? raw.nextStep : fallback.nextStep,
    tutorStyle: typeof raw.tutorStyle === "string" ? raw.tutorStyle : fallback.tutorStyle,
    revealLevel: typeof raw.revealLevel === "string" ? raw.revealLevel : fallback.revealLevel,
    source: normalizedSourceMeta.source,
    reason: normalizedSourceMeta.reason
  };
}

export class FeedbackEvaluator {
  constructor({ ollamaClient }) {
    this.ollamaClient = ollamaClient;
  }

  async evaluate({ exercise, runResult, userState, policy, studentRequest = "" }) {
    const fallback = buildFallbackFeedback({
      exercise,
      runResult,
      userState,
      policy,
      studentRequest
    });
    const prompt = buildFeedbackPrompt({
      exercise,
      runResult,
      userState,
      policy,
      studentRequest,
      fallback
    });
    const result = await this.ollamaClient.generateJson({
      prompt,
      fallback,
      validate: validateFeedbackPayload,
      temperature: 0,
      maxRetries: 0
    });

    const validation = validateFeedbackPayload(result.data);
    const normalizedData = validation.ok
      ? coerceFeedbackSpecificity(result.data, fallback, runResult, policy)
      : fallback;
    const safeData = validation.ok ? normalizedData : fallback;
    const safeMeta = validation.ok
      ? result.meta
      : {
          ...result.meta,
          source: "fallback",
          reason: "schema mismatch after client validation"
        };

    return normalizeFeedback(safeData, fallback, safeMeta);
  }
}
