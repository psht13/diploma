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

function syncActiveModel() {
  const selectedModel = ui.modelInput.value.trim() || DEFAULT_MODEL;
  ollamaClient.setModel(selectedModel);
  return selectedModel;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

  if (!transcript.length) {
    ui.transcript.innerHTML = "<p class=\"empty-state\">Діалог ще не розпочато.</p>";
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
    .join("");
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
  ui.llmStatus.textContent = "Перевірка підключення...";

  try {
    const status = await ollamaClient.getStatus();
    ui.llmStatus.textContent = status.message;
  } catch (error) {
    logUiError("refreshStatus", error);
    ui.llmStatus.textContent = `Не вдалося перевірити модель ${model}. Буде використано fallback-режим.`;
  }
}

async function handleGenerateExercise() {
  syncActiveModel();
  ui.generateBtn.disabled = true;
  ui.generateBtn.textContent = "Генерація...";

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
    ui.generateBtn.disabled = false;
    ui.generateBtn.textContent = "Згенерувати вправу";
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

  ui.runTestsBtn.disabled = true;
  const studentCode = ui.codeInput.value;
  sessionMemory.addStudentMessage(`Спроба ${sessionMemory.getUserState().attemptsCount + 1}.`);

  try {
    const runResult = await runExerciseTests({
      userCode: studentCode,
      exercise: currentExercise
    });

    sessionMemory.recordRunResult(runResult);
    renderTestSummary(runResult);
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
    ui.runTestsBtn.disabled = false;
  }
}

async function handleExplainRequest() {
  if (!currentExercise) {
    return;
  }

  ui.explainBtn.disabled = true;
  const studentRequest =
    ui.questionInput.value.trim() ||
    `Поясни, як підступитися до вправи «${currentExercise.title}».`;
  sessionMemory.addStudentMessage(studentRequest);

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
    ui.explainBtn.disabled = false;
  }
}

function handleSessionExport() {
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
refreshStatus();
