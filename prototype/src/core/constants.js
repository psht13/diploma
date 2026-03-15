export const OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_MODEL = "llama3.1:8b";
export const DEFAULT_TIMEOUT_MS = 2500;
export const MAX_JSON_RETRIES = 2;

export const TOPIC_LABELS = {
  functions: "Функції",
  arrays: "Масиви",
  strings: "Рядки",
  objects: "Об'єкти"
};

export const DECISION_MATRIX = [
  {
    state: "Усі тести пройдено",
    action: "celebrate_and_reflect",
    tutorMove: "Коротко похвалити й запропонувати пояснити хід думок"
  },
  {
    state: "Перша помилка або часткове проходження тестів",
    action: "minimal_hint",
    tutorMove: "Натякнути на ідею без готового розв'язку"
  },
  {
    state: "Повторна помилка того самого типу або серія невдалих спроб",
    action: "targeted_hint",
    tutorMove: "Вказати на конкретний збій і пов'язану концепцію"
  },
  {
    state: "Синтаксична помилка",
    action: "syntax_repair",
    tutorMove: "Пояснити, де шукати синтаксичну проблему"
  },
  {
    state: "Прямий запит на пояснення",
    action: "concept_explanation",
    tutorMove: "Дати коротке пояснення концепції без повного коду"
  }
];
