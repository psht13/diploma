import { DECISION_MATRIX, DEFAULT_MODEL } from "./core/constants.js";
import { listFallbackExercises } from "./content/fallbackExercises.js";
import { ExerciseGenerator } from "./services/exerciseGenerator.js";
import { FeedbackEvaluator } from "./services/feedbackEvaluator.js";
import { OllamaClient } from "./services/ollamaClient.js";
import { runExerciseTests } from "./services/clientTestRunner.js";
import { decideTutorAction } from "./services/tutorPolicy.js";
import { SessionMemory } from "./state/sessionMemory.js";

const ui = {
  llmStatus: document.querySelector("#llm-status"),
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

let currentExercise = null;
let activeUiTask = null;

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

function buildPendingMarkup(title, detail) {
  return `
    <div class="pending-stack">
      <span class="spinner" aria-hidden="true"></span>
      <div class="pending-copy">
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

function renderActivityCard() {
  if (!activeUiTask) {
    ui.activityCard.className = "activity-card idle";
    ui.activityCard.innerHTML = `
      <div class="pending-copy">
        <p class="pending-title">Система готова до взаємодії</p>
        <p>Статус агента, генерації, перевірки та експорту завжди показується явно.</p>
      </div>
    `;
    return;
  }

  ui.activityCard.className = "activity-card pending";
  ui.activityCard.innerHTML = buildPendingMarkup(activeUiTask.title, activeUiTask.detail);
}

function renderExercisePending(title, detail) {
  ui.exerciseCard.className = "exercise-card pending-state";
  ui.exerciseCard.innerHTML = buildPendingMarkup(title, detail);
}

function renderSummaryPending(title, detail) {
  ui.testSummary.className = "summary-card pending-state";
  ui.testSummary.innerHTML = buildPendingMarkup(title, detail);
}

function renderFeedbackPending(title, detail) {
  ui.feedbackCard.className = "feedback-card pending-state";
  ui.feedbackCard.innerHTML = buildPendingMarkup(title, detail);
}

function renderExercise(exercise) {
  if (!exercise) {
    ui.exerciseCard.className = "exercise-card empty-state";
    ui.exerciseCard.textContent = "Спочатку згенеруйте вправу.";
    return;
  }

  const testsMarkup = exercise.tests
    .map(
      (test) =>
        `<li><strong>${escapeHtml(test.name)}</strong>: args = <code>${escapeHtml(
          JSON.stringify(test.args)
        )}</code>, expected = <code>${escapeHtml(JSON.stringify(test.expected))}</code></li>`
    )
    .join("");

  const concepts = exercise.concepts
    .map((concept) => `<span class="pill">${escapeHtml(concept)}</span>`)
    .join("");

  ui.exerciseCard.className = "exercise-card";
  ui.exerciseCard.innerHTML = `
    <h3>${escapeHtml(exercise.title)}</h3>
    <p class="meta-line">Тема: ${escapeHtml(exercise.topic)} | Джерело: ${escapeHtml(
      exercise.source
    )}</p>
    <p>${escapeHtml(exercise.prompt)}</p>
    <p class="meta-line">Очікувана функція: <code>${escapeHtml(exercise.functionName)}</code></p>
    <div class="code-block">${escapeHtml(exercise.starterCode)}</div>
    <div>${concepts}</div>
    <div class="test-list">
      <strong>Тести</strong>
      <ul>${testsMarkup}</ul>
    </div>
  `;
}

function renderTestSummary(runResult) {
  if (!runResult) {
    ui.testSummary.className = "summary-card";
    ui.testSummary.textContent = "Результати тестів ще відсутні.";
    return;
  }

  const summaryClass = runResult.allPassed
    ? "summary-card success"
    : runResult.syntaxError
      ? "summary-card error"
      : "summary-card warning";

  const failureMarkup = (runResult.failures || [])
    .slice(0, 3)
    .map((failure) => `<li>${escapeHtml(failure.name)}</li>`)
    .join("");

  ui.testSummary.className = summaryClass;
  ui.testSummary.innerHTML = `
    <strong>${escapeHtml(runResult.status)}</strong>
    <p class="summary-meta">Пройдено ${runResult.passedCount}/${runResult.totalCount} тестів за ${
      runResult.durationMs
    } мс.</p>
    ${
      runResult.syntaxError
        ? `<p>${escapeHtml(runResult.syntaxError)}</p>`
        : failureMarkup
          ? `<ul>${failureMarkup}</ul>`
          : "<p>Критичних відхилень не виявлено.</p>"
    }
  `;
}

function renderFeedback(feedback) {
  if (!feedback) {
    ui.feedbackCard.className = "feedback-card empty-state";
    ui.feedbackCard.textContent = "Тут з'явиться зворотний зв'язок від агента.";
    return;
  }

  ui.feedbackCard.className = "feedback-card";
  ui.feedbackCard.innerHTML = `
    <h3>Фідбек (${escapeHtml(feedback.source)})</h3>
    <p>${escapeHtml(feedback.summary)}</p>
    <p><strong>Наступний крок:</strong> ${escapeHtml(feedback.nextStep)}</p>
    <p class="meta-line">Стиль: ${escapeHtml(feedback.tutorStyle)} | Рівень розкриття: ${escapeHtml(
      feedback.revealLevel
    )}</p>
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
  const stateEntries = [
    ["Рівень знань", state.knowledgeLevel],
    ["Історія помилок", state.errorHistory.length ? state.errorHistory[0].detail : "немає"],
    ["Впевненість", state.confidence],
    ["Поточна тема", state.currentTopic],
    ["Кількість спроб", String(state.attemptsCount)],
    ["Остання дія", state.lastAction]
  ];

  ui.userStateCard.innerHTML = stateEntries
    .map(
      ([label, value]) => `
        <div class="state-card">
          <p class="state-label">${escapeHtml(label)}</p>
          <p class="state-value">${escapeHtml(value)}</p>
        </div>
      `
    )
    .join("");
}

function renderTranscript() {
  const transcript = sessionMemory.getTranscript();
  const pendingMarkup =
    activeUiTask?.showTranscriptBubble
      ? `
        <article class="message tutor pending" aria-live="polite">
          <p class="message-role">Репетитор</p>
          ${buildPendingMarkup(activeUiTask.title, activeUiTask.detail)}
        </article>
      `
      : "";

  if (!transcript.length) {
    ui.transcript.innerHTML = pendingMarkup || "<p class=\"empty-state\">Діалог ще не розпочато.</p>";
    return;
  }

  ui.transcript.innerHTML = transcript
    .map(
      (entry) => `
        <article class="message ${entry.role}">
          <p class="message-role">${entry.role === "user" ? "Студент" : "Репетитор"}</p>
          <p>${escapeHtml(entry.content)}</p>
        </article>
      `
    )
    .join("") + pendingMarkup;
}

function renderInitialDemoNote() {
  const fallbackTitles = listFallbackExercises()
    .map((exercise) => exercise.title)
    .slice(0, 3)
    .join(", ");

  ui.feedbackCard.className = "feedback-card";
  ui.feedbackCard.innerHTML = `
    <h3>Готовність прототипу</h3>
    <p>Прототип підтримує fallback-вправи: ${escapeHtml(fallbackTitles)}.</p>
    <p><strong>Матриця рішень:</strong> ${escapeHtml(
      DECISION_MATRIX.map((row) => `${row.state} -> ${row.action}`).join("; ")
    )}</p>
  `;
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
    detail: "Оновлюємо доступність Ollama та шукаємо локальну модель для наступного запиту.",
    lockScope: "self",
    showTranscriptBubble: false
  });
  ui.llmStatus.innerHTML = buildInlineStatusMarkup("Перевіряється стан моделі...");

  try {
    const status = await ollamaClient.getStatus();
    ui.llmStatus.textContent = status.message;
  } catch (error) {
    logUiError("refreshStatus", error);
    ui.llmStatus.textContent = `Не вдалося перевірити модель ${model}. Буде використано fallback-режим.`;
  } finally {
    clearUiTask("refreshStatus");
  }
}

async function handleGenerateExercise() {
  syncActiveModel();
  setUiTask({
    key: "generateExercise",
    title: "Генерується вправа...",
    detail: "Агент формує JSON-вправу або переходить у fallback-режим без зависання інтерфейсу.",
    lockScope: "all",
    showTranscriptBubble: true
  });
  renderExercisePending(
    "Генерується вправа...",
    "Після завершення тут з'являться умова, starter code і тести."
  );
  renderSummaryPending(
    "Очікуємо нове завдання...",
    "Результати тестів з'являться після першого прогону для нової вправи."
  );
  renderFeedbackPending(
    "Агент готує стартовий контекст...",
    "Після генерації тут з'явиться фідбек або системне повідомлення."
  );

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
    logUiError("generateExercise", error);
    renderSystemFeedback({
      summary: "Не вдалося підготувати вправу.",
      nextStep:
        "Перевірте параметри моделі або повторіть спробу. Якщо Ollama недоступна, прототип має перейти у fallback-режим."
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
    renderFeedback({
      summary: "Спочатку потрібно згенерувати вправу.",
      nextStep: "Оберіть тему й створіть завдання.",
      tutorStyle: "minimal",
      revealLevel: "none",
      source: "system"
    });
    return;
  }

  setUiTask({
    key: "runTests",
    title: "Виконується перевірка...",
    detail: "Код запускається у Web Worker, після чого агент підбере наступний крок.",
    lockScope: "all",
    showTranscriptBubble: true
  });
  renderSummaryPending(
    "Виконується перевірка...",
    "Тести виконуються у клієнтському ізольованому середовищі."
  );
  renderFeedbackPending(
    "Агент очікує результати тестів...",
    "Щойно sandbox завершить виконання, тут з'явиться адаптивний фідбек."
  );
  const studentCode = ui.codeInput.value;
  sessionMemory.addStudentMessage(`Спроба ${sessionMemory.getUserState().attemptsCount + 1}.`);
  renderTranscript();

  try {
    const runResult = await runExerciseTests({
      userCode: studentCode,
      exercise: currentExercise
    });

    sessionMemory.recordRunResult(runResult);
    renderTestSummary(runResult);
    setUiTask({
      key: "runTests",
      title: "Агент формує відповідь...",
      detail: "Вибирається рівень підказки відповідно до результатів тестів та історії помилок.",
      lockScope: "all",
      showTranscriptBubble: true
    });
    renderFeedbackPending(
      "Агент формує відповідь...",
      "Фідбек з'явиться після аналізу першого збою та вибору педагогічної дії."
    );
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
      nextStep: "Повторіть спробу. Деталі помилки виведено в console для діагностики."
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
    detail: "Пакуємо transcript, результати прогонів і стан сесії в окремий файл.",
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
        "Файл містить тему, складність, кількість спроб, першу помилку, transcript і фінальний статус прогону."
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
  ui.llmStatus.textContent = `Обрано модель ${selectedModel}. Вона буде використана під час наступного LLM-виклику.`;
});
ui.generateBtn.addEventListener("click", handleGenerateExercise);
ui.runTestsBtn.addEventListener("click", handleRunTests);
ui.explainBtn.addEventListener("click", handleExplainRequest);
ui.exportSessionBtn.addEventListener("click", handleSessionExport);

renderExercise(null);
renderTestSummary(null);
renderUserState();
renderTranscript();
renderInitialDemoNote();
renderActivityCard();
syncActionButtons();
refreshStatus();
