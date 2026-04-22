import { DEFAULT_MODEL } from "./core/constants.js";
import { ExerciseGenerator } from "./services/exerciseGenerator.js";
import { FeedbackEvaluator } from "./services/feedbackEvaluator.js";
import { OllamaClient } from "./services/ollamaClient.js";
import { runExerciseTests } from "./services/clientTestRunner.js";
import { decideTutorAction } from "./services/tutorPolicy.js";
import { SessionMemory } from "./state/sessionMemory.js";

const ui = {
  llmStatus: document.querySelector("#llm-status"),
  llmStatusNote: document.querySelector("#llm-status-note"),
  modelStatusCard: document.querySelector("#model-status-card"),
  modelStatusChip: document.querySelector("#model-status-chip"),
  modelInput: document.querySelector("#model-input"),
  refreshStatusBtn: document.querySelector("#refresh-status-btn"),
  topicSelect: document.querySelector("#topic-select"),
  difficultySelect: document.querySelector("#difficulty-select"),
  generateBtn: document.querySelector("#generate-btn"),
  exerciseCard: document.querySelector("#exercise-card"),
  codeInput: document.querySelector("#code-input"),
  questionInput: document.querySelector("#question-input"),
  runTestsBtn: document.querySelector("#run-tests-btn"),
  explainBtn: document.querySelector("#explain-btn"),
  exportSessionBtn: document.querySelector("#export-session-btn"),
  activityCard: document.querySelector("#activity-card"),
  testSummary: document.querySelector("#test-summary"),
  feedbackCard: document.querySelector("#feedback-card"),
  userStateCard: document.querySelector("#user-state-card"),
  transcript: document.querySelector("#transcript")
};

const ollamaClient = new OllamaClient({ model: DEFAULT_MODEL });
const exerciseGenerator = new ExerciseGenerator({ ollamaClient });
const feedbackEvaluator = new FeedbackEvaluator({ ollamaClient });
const sessionMemory = new SessionMemory();

const DIFFICULTY_LABELS = {
  basic: "Базова",
  "basic-plus": "Базова+"
};

const SOURCE_LABELS = {
  ollama: "Локальна модель",
  fallback: "Резервний режим",
  system: "Система"
};

const SOURCE_TONE_CLASSES = {
  ollama: "is-ollama",
  fallback: "is-fallback",
  system: "is-system"
};

const FEEDBACK_STYLE_LABELS = {
  minimal: "Мінімальна підказка",
  targeted: "Адресна підказка",
  conceptual: "Режим пояснення",
  celebration: "Рефлексія після успіху",
  syntax: "Синтаксичне виправлення",
  system: "Службове повідомлення"
};

const REVEAL_LEVEL_LABELS = {
  none: "Без розкриття розв'язку",
  low: "Низький рівень розкриття",
  medium: "Середній рівень розкриття"
};

const LAST_ACTION_LABELS = {
  idle: "очікування",
  exercise_generated: "вправу підготовлено",
  celebrate_and_reflect: "рефлексія після успіху",
  minimal_hint: "мінімальна підказка",
  targeted_hint: "адресна підказка",
  syntax_repair: "виправлення синтаксису",
  concept_explanation: "режим пояснення"
};

const BUTTON_COPY = {
  refreshStatus: {
    element: ui.refreshStatusBtn,
    idle: "Оновити статус",
    busy: "Перевіряється..."
  },
  generateExercise: {
    element: ui.generateBtn,
    idle: "Згенерувати вправу",
    busy: "Генерується вправа..."
  },
  runTests: {
    element: ui.runTestsBtn,
    idle: "Запустити тести",
    busy: "Виконується перевірка..."
  },
  explainRequest: {
    element: ui.explainBtn,
    idle: "Пояснити тему",
    busy: "Готується пояснення..."
  },
  exportSession: {
    element: ui.exportSessionBtn,
    idle: "Експортувати сесію JSON",
    busy: "Готується експорт..."
  }
};

const timeFormatter = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit"
});

let currentExercise = null;
let activeUiTask = null;

function syncActiveModel() {
  const selectedModel = ui.modelInput.value.trim() || DEFAULT_MODEL;
  ollamaClient.setModel(selectedModel);
  return selectedModel;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTextBlock(text) {
  const paragraphs = String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '<div class="text-block"><p></p></div>';
  }

  return `
    <div class="text-block">
      ${paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </div>
  `;
}

function formatJsonValue(value) {
  if (typeof value === "undefined") {
    return "undefined";
  }

  return JSON.stringify(value);
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return timeFormatter.format(date);
}

function difficultyLabel(value) {
  return DIFFICULTY_LABELS[value] || value;
}

function sourceLabel(value) {
  return SOURCE_LABELS[value] || "Система";
}

function sourceToneClass(value) {
  return SOURCE_TONE_CLASSES[value] || "is-system";
}

function feedbackStyleLabel(value) {
  return FEEDBACK_STYLE_LABELS[value] || "Службове повідомлення";
}

function revealLevelLabel(value) {
  return REVEAL_LEVEL_LABELS[value] || "Без уточнення";
}

function feedbackDiagnosticLabel(reason) {
  if (!reason) {
    return "";
  }

  if (reason.includes("Schema mismatch")) {
    return "Резервний режим увімкнено, бо модель повернула JSON не за очікуваною схемою.";
  }

  if (reason.includes("valid JSON")) {
    return "Резервний режим увімкнено, бо модель не повернула валідний JSON.";
  }

  if (reason.includes("fetch failed")) {
    return "Резервний режим увімкнено, бо не вдалося звернутися до локальної Ollama.";
  }

  if (reason.includes("HTTP")) {
    return "Резервний режим увімкнено, бо Ollama повернула помилку HTTP.";
  }

  return `Резервний режим увімкнено: ${reason}`;
}

function lastActionLabel(value) {
  return LAST_ACTION_LABELS[value] || value || "очікування";
}

function buildPendingMarkup(title, detail, label = "Триває виконання") {
  return `
    <div class="pending-stack">
      <span class="spinner" aria-hidden="true"></span>
      <div class="pending-copy">
        <p class="subtle-label">${escapeHtml(label)}</p>
        <p class="pending-title">${escapeHtml(title)}</p>
        <p>${escapeHtml(detail)}</p>
      </div>
    </div>
  `;
}

function buildInlineStatusMarkup(text) {
  return `
    <span class="status-inline">
      <span class="spinner spinner-inline" aria-hidden="true"></span>
      <span>${escapeHtml(text)}</span>
    </span>
  `;
}

function buildEmptyStateMarkup({ eyebrow, title, detail }) {
  return `
    <div class="empty-state-card reveal">
      <p class="section-kicker">${escapeHtml(eyebrow)}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function setUiTask(task) {
  activeUiTask = task;
  renderActivityCard();
  renderTranscript();
  syncActionButtons();
}

function clearUiTask(key) {
  if (!activeUiTask) {
    return;
  }

  if (key && activeUiTask.key !== key) {
    return;
  }

  activeUiTask = null;
  renderActivityCard();
  renderTranscript();
  syncActionButtons();
}

function isButtonDisabled(key) {
  if (!activeUiTask) {
    return false;
  }

  if (activeUiTask.key === key) {
    return true;
  }

  return activeUiTask.lockScope === "all" && key !== "refreshStatus";
}

function syncActionButtons() {
  Object.entries(BUTTON_COPY).forEach(([key, config]) => {
    config.element.disabled = isButtonDisabled(key);
    config.element.textContent = activeUiTask?.key === key ? config.busy : config.idle;
  });
}

function renderModelStatus({ state = "idle", chip, title, detail }) {
  ui.modelStatusCard.dataset.state = state;
  ui.modelStatusChip.className = `status-chip is-${state}`;
  ui.modelStatusChip.textContent = chip;

  if (state === "checking") {
    ui.llmStatus.innerHTML = buildInlineStatusMarkup(title);
  } else {
    ui.llmStatus.textContent = title;
  }

  ui.llmStatusNote.textContent = detail;
}

function renderActivityCard() {
  if (!activeUiTask) {
    ui.activityCard.className = "activity-card idle reveal";
    ui.activityCard.innerHTML = `
      <div class="activity-shell">
        <div class="activity-copy">
          <p class="section-kicker">Стан взаємодії</p>
          <h3>Система готова до взаємодії</h3>
          <p>Основні дії доступні. Під час очікування інтерфейс завжди показує явний поточний стан.</p>
        </div>
        <span class="result-pill is-success">Готово</span>
      </div>
    `;
    return;
  }

  ui.activityCard.className = "activity-card pending reveal";
  ui.activityCard.innerHTML = `
    <div class="activity-shell">
      <div class="activity-copy">
        <p class="section-kicker">Стан взаємодії</p>
        <h3>${escapeHtml(activeUiTask.title)}</h3>
      </div>
      <span class="result-pill is-info">Виконується</span>
    </div>
    ${buildPendingMarkup(activeUiTask.title, activeUiTask.detail)}
  `;
}

function renderExercisePending(title, detail) {
  ui.exerciseCard.className = "exercise-card pending-state reveal";
  ui.exerciseCard.innerHTML = buildPendingMarkup(title, detail);
}

function renderSummaryPending(title, detail) {
  ui.testSummary.className = "summary-card pending-state reveal";
  ui.testSummary.innerHTML = buildPendingMarkup(title, detail);
}

function renderFeedbackPending(title, detail) {
  ui.feedbackCard.className = "feedback-card pending-state reveal";
  ui.feedbackCard.innerHTML = buildPendingMarkup(title, detail);
}

function renderExercise(exercise) {
  if (!exercise) {
    ui.exerciseCard.className = "exercise-card empty-state";
    ui.exerciseCard.innerHTML = buildEmptyStateMarkup({
      eyebrow: "Вправа",
      title: "Вправа ще не підготовлена",
      detail:
        "Оберіть тему й складність, а потім згенеруйте вправу. Після цього тут з'являться умова, код і перевірочні тести."
    });
    return;
  }

  const testsMarkup = exercise.tests
    .map(
      (test) => `
        <article class="test-card">
          <p class="test-card-name">${escapeHtml(test.name)}</p>
          <p class="test-card-copy">
            Аргументи: <code>${escapeHtml(JSON.stringify(test.args))}</code><br />
            Очікуване значення: <code>${escapeHtml(formatJsonValue(test.expected))}</code>
          </p>
        </article>
      `
    )
    .join("");

  const conceptsMarkup = exercise.concepts
    .map((concept) => `<span class="pill">${escapeHtml(concept)}</span>`)
    .join("");

  const rubricMarkup = exercise.rubric
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  ui.exerciseCard.className = "exercise-card reveal";
  ui.exerciseCard.innerHTML = `
    <div class="exercise-head">
      <div>
        <p class="section-kicker">Поточна вправа</p>
        <h3>${escapeHtml(exercise.title)}</h3>
      </div>
      <div class="exercise-meta">
        <span class="source-pill ${sourceToneClass(exercise.source)}">${escapeHtml(sourceLabel(exercise.source))}</span>
        <span class="meta-pill">${escapeHtml(exercise.topic)}</span>
        <span class="meta-pill">${escapeHtml(difficultyLabel(exercise.difficulty))}</span>
      </div>
    </div>

    <div class="exercise-grid">
      <section class="exercise-block">
        <p class="block-kicker">Формулювання задачі</p>
        <p>${escapeHtml(exercise.prompt)}</p>
      </section>

      <section class="exercise-block">
        <p class="block-kicker">Сигнатура функції</p>
        <p>Очікувана функція: <code>${escapeHtml(exercise.functionName)}</code></p>
        <p class="summary-copy">Початковий код винесено окремо, щоб студент міг одразу почати розв'язок.</p>
      </section>

      <section class="exercise-block">
        <p class="block-kicker">Початковий код</p>
        <pre class="code-block"><code>${escapeHtml(exercise.starterCode)}</code></pre>
      </section>

      <section class="exercise-block">
        <p class="block-kicker">Критерії оцінювання</p>
        <ul class="rubric-list">${rubricMarkup}</ul>
      </section>

      <section class="exercise-block is-wide">
        <p class="block-kicker">Поняття</p>
        <div class="chip-row">${conceptsMarkup}</div>
      </section>

      <section class="exercise-block is-wide">
        <p class="block-kicker">Перевірочні тести</p>
        <div class="tests-grid">${testsMarkup}</div>
      </section>
    </div>
  `;
}

function getRunResultPresentation(runResult) {
  if (runResult.allPassed) {
    return {
      tone: "success",
      pillClass: "is-success",
      pillText: "Успіх",
      title: "Усі перевірочні тести пройдено",
      nextStep: "Спробуйте коротко пояснити алгоритм власними словами або переходьте до нової вправи."
    };
  }

  if (runResult.syntaxError) {
    return {
      tone: "error",
      pillClass: "is-error",
      pillText: "Помилка",
      title: "Виявлено синтаксичну або внутрішню помилку",
      nextStep: "Перевірте синтаксис, виправте помилку та повторно запустіть перевірку."
    };
  }

  return {
    tone: "warning",
    pillClass: "is-warning",
    pillText: "Потрібне доопрацювання",
    title: "Частина перевірочних тестів не пройдена",
    nextStep: "Почніть із першого збою: звірте очікуване значення та перевірте відповідний фрагмент логіки."
  };
}

function renderTestSummary(runResult) {
  if (!runResult) {
    ui.testSummary.className = "summary-card empty-state";
    ui.testSummary.innerHTML = buildEmptyStateMarkup({
      eyebrow: "Результати перевірки",
      title: "Запуск тестів ще не виконувався",
      detail:
        "Після першої перевірки тут з'являться підсумок, проходження по тестах і рекомендований наступний крок."
    });
    return;
  }

  const presentation = getRunResultPresentation(runResult);
  const totalCount = runResult.totalCount || 0;
  const failedCount = Math.max(totalCount - runResult.passedCount, 0);
  const failuresByName = new Map((runResult.failures || []).map((failure) => [failure.name, failure]));

  const detailRows = runResult.syntaxError
    ? `
        <li class="test-result-row is-fail">
          <div>
            <p class="test-result-name">Деталі помилки</p>
            <p class="test-result-copy">${escapeHtml(runResult.syntaxError)}</p>
          </div>
          <span class="result-pill is-error">Потребує уваги</span>
        </li>
      `
    : (currentExercise?.tests || [])
        .map((test) => {
          const failure = failuresByName.get(test.name);

          if (!failure) {
            return `
              <li class="test-result-row is-pass">
                <div>
                  <p class="test-result-name">${escapeHtml(test.name)}</p>
                  <p class="test-result-copy">Сценарій пройдено без зауважень.</p>
                </div>
                <span class="result-pill is-success">Пройдено</span>
              </li>
            `;
          }

          const failureDetail = failure.runtimeError
            ? `Під час виконання отримано помилку: ${failure.actual}.`
            : `Очікувалося ${formatJsonValue(failure.expected)}, отримано ${formatJsonValue(failure.actual)}.`;

          return `
            <li class="test-result-row is-fail">
              <div>
                <p class="test-result-name">${escapeHtml(test.name)}</p>
                <p class="test-result-copy">${escapeHtml(failureDetail)}</p>
              </div>
              <span class="result-pill is-warning">Не пройдено</span>
            </li>
          `;
        })
        .join("");

  ui.testSummary.className = `summary-card ${presentation.tone} reveal`;
  ui.testSummary.innerHTML = `
    <div class="summary-head">
      <div>
        <p class="section-kicker">Результати перевірки</p>
        <h3>${escapeHtml(presentation.title)}</h3>
        <p class="summary-copy">Перевірку завершено за ${runResult.durationMs} мс.</p>
      </div>
      <span class="result-pill ${presentation.pillClass}">${escapeHtml(presentation.pillText)}</span>
    </div>

    <div class="summary-metrics">
      <div class="metric-card">
        <span class="metric-label">Пройдено</span>
        <strong class="metric-value">${runResult.passedCount}</strong>
      </div>
      <div class="metric-card">
        <span class="metric-label">Потребує уваги</span>
        <strong class="metric-value">${failedCount}</strong>
      </div>
      <div class="metric-card">
        <span class="metric-label">Усього тестів</span>
        <strong class="metric-value">${totalCount}</strong>
      </div>
    </div>

    <ul class="summary-detail-list">${detailRows}</ul>
    <p class="summary-next-step"><strong>Наступний крок:</strong> ${escapeHtml(presentation.nextStep)}</p>
  `;
}

function renderFeedback(feedback) {
  if (!feedback) {
    ui.feedbackCard.className = "feedback-card empty-state";
    ui.feedbackCard.innerHTML = buildEmptyStateMarkup({
      eyebrow: "Зворотний зв'язок",
      title: "Пояснення або фідбек ще не сформовано",
      detail:
        "Після перевірки або натискання «Пояснити тему» тут з'явиться відповідь агента з коротким поясненням і наступним кроком."
    });
    return;
  }

  ui.feedbackCard.className = "feedback-card reveal";
  const diagnosticText =
    feedback.source === "fallback" ? feedbackDiagnosticLabel(feedback.reason) : "";
  ui.feedbackCard.innerHTML = `
    <div class="feedback-head">
      <div>
        <p class="section-kicker">Зворотний зв'язок агента</p>
        <h3>${feedback.source === "system" ? "Системне повідомлення" : "Репетиторська відповідь готова"}</h3>
      </div>
      <span class="source-pill ${sourceToneClass(feedback.source)}">${escapeHtml(sourceLabel(feedback.source))}</span>
    </div>

    <div class="feedback-layout">
      <section class="feedback-section">
        <h4>Коротке пояснення</h4>
        ${formatTextBlock(feedback.summary)}
      </section>

      <section class="feedback-section">
        <h4>Наступний крок</h4>
        ${formatTextBlock(feedback.nextStep)}
      </section>
    </div>

    <div class="chip-row">
      <span class="style-pill">${escapeHtml(feedbackStyleLabel(feedback.tutorStyle))}</span>
      <span class="style-pill">${escapeHtml(revealLevelLabel(feedback.revealLevel))}</span>
    </div>

    ${
      diagnosticText
        ? `<p class="feedback-diagnostic">${escapeHtml(diagnosticText)}</p>`
        : ""
    }
  `;
}

function renderSystemFeedback({
  summary,
  nextStep,
  source = "system",
  tutorStyle = "system",
  revealLevel = "none"
}) {
  renderFeedback({
    summary,
    nextStep,
    source,
    tutorStyle,
    revealLevel
  });
}

function renderUserState() {
  const state = sessionMemory.getUserState();
  const currentError = state.errorHistory.length ? state.errorHistory[0].detail : "ще не зафіксовано";
  const currentTopic = state.currentTopic === "не вибрано" ? "ще не обрано" : state.currentTopic;

  const stateEntries = [
    ["Рівень знань", state.knowledgeLevel],
    ["Історія помилок", currentError],
    ["Впевненість", state.confidence],
    ["Поточна тема", currentTopic],
    ["Кількість спроб", String(state.attemptsCount)],
    ["Остання дія", lastActionLabel(state.lastAction)]
  ];

  ui.userStateCard.innerHTML = stateEntries
    .map(
      ([label, value]) => `
        <article class="state-card">
          <p class="state-label">${escapeHtml(label)}</p>
          <p class="state-value">${escapeHtml(value)}</p>
        </article>
      `
    )
    .join("");
}

function renderTranscript() {
  const transcript = sessionMemory.getTranscript();
  const pendingMarkup = activeUiTask?.showTranscriptBubble
    ? `
        <article class="message tutor pending reveal" aria-live="polite">
          <div class="message-meta">
            <p class="message-role">Репетитор</p>
          </div>
          <div class="message-bubble">
            ${buildPendingMarkup(activeUiTask.title, activeUiTask.detail)}
          </div>
        </article>
      `
    : "";

  if (!transcript.length) {
    ui.transcript.innerHTML =
      pendingMarkup ||
      buildEmptyStateMarkup({
        eyebrow: "Діалог",
        title: "Діалог ще не розпочато",
        detail:
          "Після підготовки вправи тут з'являться повідомлення студента й репетитора, а також проміжні стани очікування."
      });
    return;
  }

  ui.transcript.innerHTML =
    transcript
      .map((entry) => {
        const roleLabel = entry.role === "user" ? "Студент" : "Репетитор";
        const timestamp = formatTimestamp(entry.timestamp);

        return `
          <article class="message ${entry.role} reveal">
            <div class="message-meta">
              <p class="message-role">${roleLabel}</p>
              ${timestamp ? `<p class="message-time">${escapeHtml(timestamp)}</p>` : ""}
            </div>
            <div class="message-bubble">
              ${formatTextBlock(entry.content)}
            </div>
          </article>
        `;
      })
      .join("") + pendingMarkup;
}

function logUiError(context, error) {
  console.error(`[ui:${context}]`, error);
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function refreshStatus() {
  const model = syncActiveModel();
  setUiTask({
    key: "refreshStatus",
    title: "Перевіряється стан моделі...",
    detail: "Оновлюємо доступність Ollama та готуємо зрозумілий статус локальної моделі.",
    lockScope: "self",
    showTranscriptBubble: false
  });
  renderModelStatus({
    state: "checking",
    chip: "Перевірка",
    title: "Перевіряється стан моделі...",
    detail: "Оновлюємо доступність Ollama та готовність резервного режиму."
  });
  await waitForPaint();

  try {
    const status = await ollamaClient.getStatus();

    if (status.available && status.hasTargetModel) {
      renderModelStatus({
        state: "ready",
        chip: "Готова",
        title: status.message,
        detail: "Локальна модель готова до генерації вправи та формування адаптивного фідбеку."
      });
    } else if (status.available) {
      renderModelStatus({
        state: "fallback",
        chip: "Резервний режим",
        title: status.message,
        detail: "Ollama доступна, але цільова модель відсутня локально. Наступні відповіді буде сформовано через резервний механізм."
      });
    } else {
      renderModelStatus({
        state: "unavailable",
        chip: "Недоступна",
        title: status.message,
        detail: "Локальна модель недоступна. Прототип зберігає працездатність через резервний режим."
      });
    }
  } catch (error) {
    logUiError("refreshStatus", error);
    renderModelStatus({
      state: "unavailable",
      chip: "Недоступна",
      title: `Не вдалося перевірити модель ${model}.`,
      detail: "Буде використано резервний режим. За потреби перевірте локальний Ollama та повторіть спробу."
    });
  } finally {
    clearUiTask("refreshStatus");
  }
}

async function handleGenerateExercise() {
  syncActiveModel();
  setUiTask({
    key: "generateExercise",
    title: "Генерується вправа...",
    detail: "Агент формує структуру вправи, початковий код, критерії оцінювання та перевірочні тести.",
    lockScope: "all",
    showTranscriptBubble: true
  });
  renderExercisePending(
    "Генерується вправа...",
    "Після завершення тут з'являться умова, початковий код, поняття та перевірочні тести."
  );
  renderSummaryPending(
    "Очікуємо нове завдання...",
    "Підсумок перевірки стане доступним після першого запуску тестів для цієї вправи."
  );
  renderFeedbackPending(
    "Агент готує стартовий контекст...",
    "Після підготовки вправи тут з'явиться пояснення або зворотний зв'язок для поточного кроку."
  );
  await waitForPaint();

  try {
    currentExercise = await exerciseGenerator.generate({
      topicKey: ui.topicSelect.value,
      difficulty: ui.difficultySelect.value
    });

    sessionMemory.resetForExercise(currentExercise);
    renderExercise(currentExercise);
    renderUserState();
    renderTranscript();
    renderTestSummary(null);
    renderFeedback(null);
    ui.codeInput.value = currentExercise.starterCode;
    ui.questionInput.value = "";
  } catch (error) {
    currentExercise = null;
    logUiError("generateExercise", error);
    renderExercise(null);
    renderTestSummary(null);
    renderSystemFeedback({
      summary: "Не вдалося підготувати вправу.",
      nextStep:
        "Перевірте доступність моделі або повторіть спробу. Якщо локальна модель недоступна, система має перейти у резервний режим."
    });
  } finally {
    clearUiTask("generateExercise");
  }
}

async function deliverTutorFeedback({
  runResult,
  studentRequest = "",
  interactionMode = "default",
  forceExplanation = false
}) {
  syncActiveModel();
  const userState = sessionMemory.getUserState();
  const policy = decideTutorAction({
    userState,
    runResult,
    studentRequest,
    interactionMode,
    forceExplanation
  });
  const feedback = await feedbackEvaluator.evaluate({
    exercise: currentExercise,
    runResult,
    userState,
    policy,
    studentRequest
  });

  sessionMemory.noteTutorAction(policy.action);
  sessionMemory.addTutorMessage(`${feedback.summary}\n${feedback.nextStep}`);
  renderFeedback(feedback);
  renderUserState();
  renderTranscript();
}

async function handleRunTests() {
  if (!currentExercise) {
    renderSystemFeedback({
      summary: "Спочатку потрібно згенерувати вправу.",
      nextStep: "Оберіть тему, підготуйте завдання, а потім запускайте перевірку коду."
    });
    return;
  }

  setUiTask({
    key: "runTests",
    title: "Виконується перевірка...",
    detail: "Код запускається у Web Worker, після чого агент інтерпретує результати тестів.",
    lockScope: "all",
    showTranscriptBubble: true
  });
  renderSummaryPending(
    "Виконується перевірка...",
    "Тести виконуються в клієнтському ізольованому середовищі без серверного виконання коду."
  );
  renderFeedbackPending(
    "Агент очікує результати тестів...",
    "Щойно sandbox завершить виконання, буде сформовано адаптивний педагогічний крок."
  );
  sessionMemory.addStudentMessage(
    `Запущено перевірку. Спроба ${sessionMemory.getUserState().attemptsCount + 1}.`
  );
  renderTranscript();
  await waitForPaint();

  try {
    const runResult = await runExerciseTests({
      userCode: ui.codeInput.value,
      exercise: currentExercise
    });

    sessionMemory.recordRunResult(runResult);
    renderTestSummary(runResult);
    setUiTask({
      key: "runTests",
      title: "Агент формує відповідь...",
      detail: "Рівень підказки обирається відповідно до результатів перевірки та історії попередніх спроб.",
      lockScope: "all",
      showTranscriptBubble: true
    });
    renderFeedbackPending(
      "Агент формує відповідь...",
      "Після аналізу першого збою й педагогічної політики тут з'явиться короткий наступний крок."
    );
    await waitForPaint();
    await deliverTutorFeedback({ runResult });
  } catch (error) {
    logUiError("runTests", error);
    renderTestSummary({
      status: "error",
      allPassed: false,
      passedCount: 0,
      totalCount: currentExercise.tests.length,
      failures: [],
      syntaxError: "Не вдалося виконати тести через внутрішню помилку.",
      durationMs: 0
    });
    renderSystemFeedback({
      summary: "Тести не були виконані через внутрішню помилку.",
      nextStep: "Повторіть спробу. Якщо проблема повториться, перегляньте console diagnostics."
    });
  } finally {
    clearUiTask("runTests");
  }
}

async function handleExplainRequest() {
  if (!currentExercise) {
    renderSystemFeedback({
      summary: "Спочатку потрібно підготувати вправу.",
      nextStep: "Згенеруйте завдання, а потім попросіть пояснення теми або алгоритму."
    });
    return;
  }

  const studentRequest =
    ui.questionInput.value.trim() ||
    `Поясни, як підступитися до вправи «${currentExercise.title}».`;

  setUiTask({
    key: "explainRequest",
    title: "Агент готує пояснення...",
    detail: "Формується концептуальна відповідь без повного розкриття розв'язку.",
    lockScope: "all",
    showTranscriptBubble: true
  });
  renderFeedbackPending(
    "Агент готує пояснення...",
    "Пояснення з'явиться після вибору концептуального режиму відповіді."
  );
  sessionMemory.addStudentMessage(studentRequest);
  renderTranscript();
  await waitForPaint();

  try {
    await deliverTutorFeedback({
      runResult: sessionMemory.getLastRunResult(),
      studentRequest,
      interactionMode: "explain"
    });
  } catch (error) {
    logUiError("explainRequest", error);
    renderSystemFeedback({
      summary: "Не вдалося підготувати пояснення.",
      nextStep: "Спробуйте ще раз. Якщо проблема повториться, перевірте console diagnostics."
    });
  } finally {
    clearUiTask("explainRequest");
  }
}

async function handleSessionExport() {
  setUiTask({
    key: "exportSession",
    title: "Готується JSON-експорт...",
    detail: "Пакуємо transcript, результати прогонів і поточний стан сесії в окремий файл.",
    lockScope: "self",
    showTranscriptBubble: false
  });
  await waitForPaint();

  const exportPayload = sessionMemory.buildSessionExport();
  const safeTopic = (exportPayload.topic || "session")
    .toLowerCase()
    .replaceAll(/[^a-zа-яіїєґ0-9]+/gi, "-")
    .replaceAll(/^-+|-+$/g, "");
  const timestampPart = exportPayload.timestamp.replaceAll(/[:.]/g, "-");
  const filename = `ains-session-${safeTopic || "session"}-${timestampPart}.json`;

  try {
    downloadJsonFile(filename, exportPayload);
    renderSystemFeedback({
      summary: "JSON-експорт сесії підготовлено.",
      nextStep:
        "Файл містить тему, складність, кількість спроб, першу помилку, transcript і фінальний статус перевірки."
    });
  } catch (error) {
    logUiError("sessionExport", error);
    renderSystemFeedback({
      summary: "Не вдалося експортувати сесію.",
      nextStep: "Повторіть спробу або перевірте browser permissions для завантаження файлів."
    });
  } finally {
    clearUiTask("exportSession");
  }
}

ui.refreshStatusBtn.addEventListener("click", refreshStatus);
ui.modelInput.addEventListener("input", () => {
  const selectedModel = ui.modelInput.value.trim() || DEFAULT_MODEL;
  ollamaClient.setModel(selectedModel);
  renderModelStatus({
    state: "idle",
    chip: "Очікує перевірки",
    title: `Обрано модель ${selectedModel}.`,
    detail: "Натисніть «Оновити статус», щоб перевірити локальну доступність і резервний режим."
  });
});
ui.generateBtn.addEventListener("click", handleGenerateExercise);
ui.runTestsBtn.addEventListener("click", handleRunTests);
ui.explainBtn.addEventListener("click", handleExplainRequest);
ui.exportSessionBtn.addEventListener("click", handleSessionExport);

renderModelStatus({
  state: "checking",
  chip: "Перевірка",
  title: "Перевіряється стан моделі...",
  detail: "Оновлюємо доступність локальної моделі та готовність резервного режиму."
});
renderExercise(null);
renderTestSummary(null);
renderFeedback(null);
renderUserState();
renderTranscript();
renderActivityCard();
syncActionButtons();
refreshStatus();
