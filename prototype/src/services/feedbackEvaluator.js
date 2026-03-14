function formatFailure(failure) {
  if (!failure) {
    return "Точковий збій ще не визначено.";
  }

  const actualValue =
    failure.actual === undefined ? "undefined" : JSON.stringify(failure.actual);
  const expectedValue =
    failure.expected === undefined ? "undefined" : JSON.stringify(failure.expected);

  return `Тест «${failure.name}» не пройдено: очікувалося ${expectedValue}, отримано ${actualValue}.`;
}

function buildFallbackFeedback({ exercise, runResult, userState, policy, studentRequest }) {
  if (policy.action === "concept_explanation") {
    return {
      summary:
        studentRequest ||
        `Пояснення для теми «${exercise.topic}»: спочатку визначте, які вхідні дані отримує функція і яке значення вона має повернути.`,
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
      nextStep:
        "Подумайте, яке проміжне значення має оновлюватися на кожній ітерації. Сконцентруйтеся на умові або накопиченні результату.",
      tutorStyle: "targeted",
      revealLevel: "medium"
    };
  }

  return {
    summary: formatFailure(runResult?.failures?.[0]),
    nextStep:
      "Зробіть один невеликий крок: опишіть, що саме має повернути функція для найпростішого прикладу, і звірте це з кодом.",
    tutorStyle: "minimal",
    revealLevel: "low"
  };
}

function buildFeedbackPrompt({ exercise, runResult, userState, policy, studentRequest }) {
  return `
Ти - доброзичливий репетитор з JavaScript для початківця.
Поверни лише JSON-об'єкт без пояснювального тексту поза JSON.

Обмеження:
- не давай повний розв'язок;
- не вставляй завершену функцію;
- дай короткий адаптивний фідбек українською;
- врахуй attemptsCount і тип дії policy.action;
- якщо є помилка, орієнтуйся на перший збій;
- якщо студент просить пояснення, дай концептуальне пояснення без готового коду.

Контекст:
${JSON.stringify(
    {
      exercise: {
        title: exercise.title,
        topic: exercise.topic,
        functionName: exercise.functionName,
        concepts: exercise.concepts
      },
      runResult,
      userState,
      policy,
      studentRequest
    },
    null,
    2
  )}

Очікувані поля:
{
  "summary": "string",
  "nextStep": "string",
  "tutorStyle": "minimal | targeted | conceptual | celebration | syntax",
  "revealLevel": "none | low | medium"
}
`.trim();
}

function normalizeFeedback(raw, fallback, meta) {
  return {
    summary: typeof raw.summary === "string" ? raw.summary : fallback.summary,
    nextStep: typeof raw.nextStep === "string" ? raw.nextStep : fallback.nextStep,
    tutorStyle: typeof raw.tutorStyle === "string" ? raw.tutorStyle : fallback.tutorStyle,
    revealLevel: typeof raw.revealLevel === "string" ? raw.revealLevel : fallback.revealLevel,
    source: meta.source
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
      studentRequest
    });
    const result = await this.ollamaClient.generateJson({
      prompt,
      fallback
    });

    return normalizeFeedback(result.data, fallback, result.meta);
  }
}
