import { buildRunErrorSignature } from "../core/runResult.js";

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

export class SessionMemory {
  constructor() {
    this.resetAll();
  }

  resetAll() {
    this.sessionStartedAt = new Date().toISOString();
    this.exercise = null;
    this.transcript = [];
    this.userState = structuredClone(DEFAULT_USER_STATE);
    this.firstFailure = null;
    this.lastRunResult = null;
    this.lastErrorSignature = null;
  }

  resetForExercise(exercise) {
    this.sessionStartedAt = new Date().toISOString();
    this.exercise = structuredClone(exercise);
    this.transcript = [];
    this.userState = {
      ...structuredClone(DEFAULT_USER_STATE),
      currentTopic: exercise.topic,
      lastAction: "exercise_generated"
    };
    this.firstFailure = null;
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

    const errorSignature = buildRunErrorSignature(runResult);

    if (errorSignature) {
      if (!this.firstFailure) {
        this.firstFailure = {
          signature: errorSignature,
          kind: runResult.syntaxError ? "syntax" : "test",
          detail: runResult.syntaxError || runResult.failures?.[0]?.name || "unknown",
          timestamp: new Date().toISOString()
        };
      }

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

  buildSessionExport({ timestamp = new Date().toISOString() } = {}) {
    return {
      topic: this.exercise?.topic ?? this.userState.currentTopic,
      difficulty: this.exercise?.difficulty ?? null,
      attemptsCount: this.userState.attemptsCount,
      firstFailure: this.firstFailure ? structuredClone(this.firstFailure) : null,
      lastAction: this.userState.lastAction,
      transcript: this.getTranscript(),
      finalRunStatus: this.lastRunResult
        ? {
            status: this.lastRunResult.status,
            allPassed: this.lastRunResult.allPassed,
            syntaxError: this.lastRunResult.syntaxError,
            passedCount: this.lastRunResult.passedCount,
            totalCount: this.lastRunResult.totalCount
          }
        : null,
      timestamp
    };
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
