const DEFAULT_USER_STATE = {
  knowledgeLevel: "початковий",
  errorHistory: [],
  confidence: "середня",
  currentTopic: "не вибрано",
  attemptsCount: 0,
  lastAction: "idle"
};

function deriveConfidence(runResult) {
  if (!runResult) {
    return "середня";
  }

  if (runResult.allPassed) {
    return "висока";
  }

  if (runResult.syntaxError || runResult.failures?.length) {
    return "низька";
  }

  return "середня";
}

function deriveKnowledgeLevel(currentLevel, attemptsCount, runResult) {
  if (!runResult) {
    return currentLevel;
  }

  if (runResult.allPassed && attemptsCount <= 1) {
    return "вище початкового";
  }

  if (runResult.allPassed && attemptsCount > 1) {
    return "стабілізується";
  }

  return currentLevel;
}

function buildErrorSignature(runResult) {
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

export class SessionMemory {
  constructor() {
    this.resetAll();
  }

  resetAll() {
    this.exercise = null;
    this.transcript = [];
    this.userState = structuredClone(DEFAULT_USER_STATE);
    this.lastRunResult = null;
    this.lastErrorSignature = null;
  }

  resetForExercise(exercise) {
    this.exercise = structuredClone(exercise);
    this.transcript = [];
    this.userState = {
      ...structuredClone(DEFAULT_USER_STATE),
      currentTopic: exercise.topic,
      lastAction: "exercise_generated"
    };
    this.lastRunResult = null;
    this.lastErrorSignature = null;
    this.addTutorMessage(
      `Підготовлено вправу «${exercise.title}». Спробуйте спочатку самостійно реалізувати функцію.`
    );
  }

  addStudentMessage(content) {
    this.transcript.push({ role: "user", content, timestamp: new Date().toISOString() });
  }

  addTutorMessage(content) {
    this.transcript.push({ role: "tutor", content, timestamp: new Date().toISOString() });
  }

  recordRunResult(runResult) {
    this.lastRunResult = structuredClone(runResult);
    this.userState.attemptsCount += 1;
    this.userState.confidence = deriveConfidence(runResult);
    this.userState.knowledgeLevel = deriveKnowledgeLevel(
      this.userState.knowledgeLevel,
      this.userState.attemptsCount,
      runResult
    );

    const errorSignature = buildErrorSignature(runResult);

    if (errorSignature) {
      this.userState.errorHistory = [
        {
          signature: errorSignature,
          kind: runResult.syntaxError ? "syntax" : "test",
          detail: runResult.syntaxError || runResult.failures?.[0]?.name || "unknown"
        },
        ...this.userState.errorHistory
      ].slice(0, 8);
    }

    this.lastErrorSignature = errorSignature;
  }

  noteTutorAction(action) {
    this.userState.lastAction = action;
  }

  getCurrentExercise() {
    return this.exercise ? structuredClone(this.exercise) : null;
  }

  getLastRunResult() {
    return this.lastRunResult ? structuredClone(this.lastRunResult) : null;
  }

  getUserState() {
    return structuredClone(this.userState);
  }

  getTranscript() {
    return this.transcript.map((entry) => ({ ...entry }));
  }

  buildFeedbackContext(studentRequest = "") {
    return {
      exercise: this.getCurrentExercise(),
      userState: this.getUserState(),
      lastRunResult: this.getLastRunResult(),
      studentRequest,
      transcriptTail: this.getTranscript().slice(-6)
    };
  }
}
