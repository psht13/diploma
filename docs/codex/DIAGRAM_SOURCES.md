# Джерела для діаграм

Нижче наведено текстові першоджерела для діаграм, які можна:

- або відрендерити окремо в Mermaid/PlantUML;
- або використати як основу для ручного вставлення рисунків у Word;
- або залишити як figure placeholders у поточній автоматично згенерованій чернетці.

## 1. Діаграма компонентів АІНС

```mermaid
flowchart LR
    Student[Студент] --> UI[Chat UI / Learning Workspace]
    UI --> PM[Perception Module]
    PM --> RM[Reasoning Module]
    RM --> AM[Action Module]
    AM --> GM[Generation Module]
    GM --> UI

    RM --> MM[Memory Module]
    MM --> Session[(Buffer / Session Memory)]
    MM --> Summary[(Summary Memory)]
    MM --> Profile[(Vector / Profile Memory)]
    MM --> Knowledge[(Knowledge Memory / Content Base)]

    RM --> StudentModel[Student Model]
    RM --> ContentModel[Knowledge & Content Model]
    RM --> TutorModel[Tutor Policy Model]

    AM --> ExerciseGenerator[ExerciseGenerator]
    AM --> FeedbackEvaluator[FeedbackEvaluator]
    AM --> TestRunner[ClientTestRunner]

    ExerciseGenerator --> LLM[Local LLM via Ollama]
    FeedbackEvaluator --> LLM
    TestRunner --> Worker[Web Worker Sandbox]
    Worker --> UI
```

### Примітка

- У прототипі реально реалізовано: `Chat UI`, `ExerciseGenerator`, `FeedbackEvaluator`, `ClientTestRunner`, `SessionMemory`, `TutorPolicy`, `OllamaClient`.
- Концептуально описано, але не реалізовано: `Summary Memory`, `Vector/Profile Memory`, `Knowledge Memory`, окремий `Perception Module`.

## 2. Sequence diagram для сценарію "згенерувати вправу -> пройти тести -> дати фідбек"

```mermaid
sequenceDiagram
    participant U as Студент
    participant UI as Chat UI
    participant EG as ExerciseGenerator
    participant OL as Ollama / Fallback
    participant SM as SessionMemory
    participant TR as ClientTestRunner
    participant WW as Web Worker
    participant TP as TutorPolicy
    participant FE as FeedbackEvaluator

    U->>UI: Обрати тему і натиснути "Згенерувати вправу"
    UI->>EG: generate(topic, difficulty)
    EG->>OL: JSON prompt for exercise
    OL-->>EG: exercise JSON або invalid JSON
    EG-->>UI: normalized exercise or fallback exercise
    UI->>SM: resetForExercise(exercise)

    U->>UI: Ввести код і натиснути "Запустити тести"
    UI->>TR: runExerciseTests(userCode, exercise)
    TR->>WW: execute user code in sandbox
    WW-->>TR: test results / syntax error / timeout
    TR-->>UI: runResult
    UI->>SM: recordRunResult(runResult)
    UI->>TP: decideTutorAction(UserState, runResult)
    TP-->>UI: policy action
    UI->>FE: evaluate(exercise, runResult, UserState, policy)
    FE->>OL: JSON prompt for feedback
    OL-->>FE: feedback JSON або invalid JSON
    FE-->>UI: normalized feedback or fallback feedback
    UI->>SM: addTutorMessage(feedback)
    UI-->>U: Адаптивний фідбек
```

## 3. Схема UserState

```mermaid
classDiagram
    class UserState {
        +knowledgeLevel: string
        +errorHistory: ErrorEntry[]
        +confidence: string
        +currentTopic: string
        +attemptsCount: number
        +lastAction: string
    }

    class ErrorEntry {
        +signature: string
        +kind: string
        +detail: string
    }

    UserState --> ErrorEntry
```

### Примітка

- У прототипі `UserState` зберігається в `SessionMemory`.
- Архітектурно в розділі 3 можна додати ще поля:
  - mastery per concept;
  - preferred explanation style;
  - session summary id;
  - long-term profile embedding id.

## 4. Спрощена deployment/runtime diagram

```mermaid
flowchart TB
    Browser[Browser Client]
    Worker[Web Worker Sandbox]
    Localhost[localhost:11434]
    Ollama[Ollama Runtime]
    Model[Llama 3.1 8B]

    Browser --> Worker
    Browser --> Localhost
    Localhost --> Ollama
    Ollama --> Model
```

### Примітка

- У поточному середовищі `ollama` не встановлено, тому в прототипі потрібно показати також fallback-режим.

## 5. Figure placeholders для Word

- Рисунок 3.1 - Загальна компонентна архітектура АІНС для JavaScript tutor.
- Рисунок 3.2 - Цикл роботи агента за патерном Reason -> Act -> Observe.
- Рисунок 3.3 - Структура `UserState` та зв'язок із `SessionMemory`.
- Рисунок 4.1 - Runtime-схема прототипу з локальним Ollama та `Web Worker`.

## 6. Підстава для ручного доопрацювання

- [ПОТРІБНО РУЧНЕ ВТРУЧАННЯ: за потреби відрендерити Mermaid-схеми у PNG/SVG і замінити figure placeholders у Word-файлі].
