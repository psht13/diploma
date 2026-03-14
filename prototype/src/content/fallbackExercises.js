const FALLBACK_EXERCISES = [
  {
    id: "functions-sum-array",
    topicKey: "functions",
    topic: "Функції",
    difficulty: "basic",
    title: "Сума елементів масиву",
    prompt:
      "Реалізуйте функцію `sumArray(numbers)`, яка повертає суму всіх чисел у масиві. Для порожнього масиву потрібно повернути 0.",
    starterCode: `function sumArray(numbers) {\n  // Поверніть суму елементів масиву\n}\n`,
    functionName: "sumArray",
    concepts: ["оголошення функції", "цикли", "масиви", "повернення значення"],
    rubric: [
      "Функція повертає число",
      "Порожній масив обробляється коректно",
      "Не змінюється вхідний масив"
    ],
    tests: [
      { name: "порожній масив", args: [[]], expected: 0 },
      { name: "три позитивні числа", args: [[1, 2, 3]], expected: 6 },
      { name: "нуль і від'ємне число", args: [[4, 0, -1]], expected: 3 }
    ]
  },
  {
    id: "arrays-count-even",
    topicKey: "arrays",
    topic: "Масиви",
    difficulty: "basic",
    title: "Порахувати парні числа",
    prompt:
      "Реалізуйте функцію `countEven(numbers)`, яка повертає кількість парних чисел у масиві.",
    starterCode: `function countEven(numbers) {\n  // Порахуйте кількість парних елементів\n}\n`,
    functionName: "countEven",
    concepts: ["масиви", "умовні оператори", "остача від ділення", "лічильник"],
    rubric: [
      "Функція повертає кількість, а не самі елементи",
      "Ураховуються від'ємні парні значення",
      "Порожній масив дає 0"
    ],
    tests: [
      { name: "без парних", args: [[1, 3, 5]], expected: 0 },
      { name: "змішаний масив", args: [[1, 2, 3, 4]], expected: 2 },
      { name: "від'ємні значення", args: [[-2, -3, -4]], expected: 2 }
    ]
  },
  {
    id: "strings-reverse-word-order",
    topicKey: "strings",
    topic: "Рядки",
    difficulty: "basic-plus",
    title: "Змінити порядок слів",
    prompt:
      "Реалізуйте функцію `reverseWords(text)`, яка приймає рядок із кількох слів і повертає рядок, у якому порядок слів змінено на протилежний.",
    starterCode: `function reverseWords(text) {\n  // Поверніть рядок зі словами у зворотному порядку\n}\n`,
    functionName: "reverseWords",
    concepts: ["рядки", "split", "join", "масиви"],
    rubric: [
      "Слова мають бути розділені пробілами",
      "Одиночне слово повертається без змін",
      "Порядок слів інвертується повністю"
    ],
    tests: [
      { name: "два слова", args: ["hello world"], expected: "world hello" },
      { name: "одне слово", args: ["javascript"], expected: "javascript" },
      { name: "три слова", args: ["learn js now"], expected: "now js learn" }
    ]
  },
  {
    id: "objects-get-full-name",
    topicKey: "objects",
    topic: "Об'єкти",
    difficulty: "basic",
    title: "Повне ім'я користувача",
    prompt:
      "Реалізуйте функцію `getFullName(user)`, яка повертає рядок із `firstName` та `lastName`, розділених пробілом.",
    starterCode: `function getFullName(user) {\n  // Поверніть повне ім'я користувача\n}\n`,
    functionName: "getFullName",
    concepts: ["об'єкти", "доступ до властивостей", "рядки"],
    rubric: [
      "Використано поля firstName і lastName",
      "Між ім'ям і прізвищем є пробіл",
      "Повертається рядок"
    ],
    tests: [
      {
        name: "звичайний випадок",
        args: [{ firstName: "Ada", lastName: "Lovelace" }],
        expected: "Ada Lovelace"
      },
      {
        name: "інший користувач",
        args: [{ firstName: "Grace", lastName: "Hopper" }],
        expected: "Grace Hopper"
      }
    ]
  }
];

export function getFallbackExercise(topicKey = "functions", difficulty = "basic") {
  const exactMatch = FALLBACK_EXERCISES.find(
    (exercise) => exercise.topicKey === topicKey && exercise.difficulty === difficulty
  );

  if (exactMatch) {
    return structuredClone(exactMatch);
  }

  const topicMatch = FALLBACK_EXERCISES.find((exercise) => exercise.topicKey === topicKey);

  if (topicMatch) {
    return structuredClone(topicMatch);
  }

  return structuredClone(FALLBACK_EXERCISES[0]);
}

export function listFallbackExercises() {
  return FALLBACK_EXERCISES.map((exercise) => structuredClone(exercise));
}
