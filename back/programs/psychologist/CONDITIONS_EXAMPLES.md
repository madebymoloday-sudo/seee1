# Примеры использования условий в программах LangGraph

## Типы условий

### 1. `exists` - Проверка существования переменной

Проверяет, что переменная существует в состоянии и не пустая.

```json
{
  "condition": {
    "type": "exists",
    "params": {
      "variable": "problem"
    },
    "errorMessage": "Сначала нужно описать проблему."
  }
}
```

### 2. `length` - Проверка длины сообщения

Проверяет длину ответа пользователя.

```json
{
  "condition": {
    "type": "length",
    "params": {
      "minLength": 10,
      "maxLength": 2000
    },
    "errorMessage": "Пожалуйста, опишите подробнее (минимум 10 символов)."
  }
}
```

### 3. `contains` - Проверка наличия подстроки

Проверяет, содержит ли ответ определенные значения.

```json
{
  "condition": {
    "type": "contains",
    "params": {
      "values": ["да", "конечно", "согласен"]
    },
    "errorMessage": "Пожалуйста, подтвердите свое согласие."
  }
}
```

Или несколько значений:

```json
{
  "condition": {
    "type": "contains",
    "params": {
      "values": ["грусть", "печаль", "тоска", "грустно"]
    }
  }
}
```

### 4. `regex` - Проверка по регулярному выражению

Проверяет соответствие ответа регулярному выражению.

```json
{
  "condition": {
    "type": "regex",
    "params": {
      "pattern": "^(да|нет|возможно)$"
    },
    "errorMessage": "Пожалуйста, ответьте да, нет или возможно."
  }
}
```

### 5. `llm-check` - Проверка через LLM

Использует LLM для проверки качества или соответствия ответа.

```json
{
  "condition": {
    "type": "llm-check",
    "params": {
      "llmPrompt": "Проверь, что ответ пользователя является описанием эмоции. Ответь только 'да' или 'нет'."
    },
    "errorMessage": "Пожалуйста, опишите эмоцию более точно."
  }
}
```

### 6. `llm-routing` - Маршрутизация через LLM на естественном языке

Использует LLM для определения следующего шага на основе условия, описанного на естественном языке.

```json
{
  "condition": {
    "type": "llm-routing",
    "params": {
      "routingCondition": "если пользователь ввел emotion, thought то перейди на why степ"
    }
  },
  "nextStep": "why"
}
```

Более сложные примеры:

```json
{
  "emotion": {
    "condition": {
      "type": "llm-routing",
      "params": {
        "routingCondition": "если эмоция отрицательная (грусть, злость, страх), перейди на step_deep_analysis, иначе на thought"
      }
    }
  }
}
```

```json
{
  "thought": {
    "condition": {
      "type": "llm-routing",
      "params": {
        "routingCondition": "если проблема содержит упоминание работы и мысль негативная, перейди на work_stress_step"
      }
    }
  }
}
```

LLM автоматически анализирует текущее состояние (problem, emotion, thought и т.д.) и определяет:

- Выполнено ли условие
- Какой следующий шаг выбрать

**Важно:** LLM должен ответить в формате JSON:

```json
{
  "passed": true,
  "nextStep": "why",
  "reason": "Пользователь ввел emotion и thought"
}
```

## Примеры использования

### Пример 1: Пропуск шага при выполнении условия

```json
{
  "stepName": {
    "question": "Вопрос...",
    "systemPrompt": "...",
    "condition": {
      "type": "exists",
      "params": {
        "variable": "previousStepVariable"
      }
    },
    "skipIfConditionFails": true,
    "nextStep": "anotherStep"
  }
}
```

### Пример 2: Пользовательская последовательность шагов

```json
{
  "stepOrder": ["problem", "emotion", "thought", "why", "conclusion"],
  "steps": {
    "problem": {
      "nextStep": "emotion"
    },
    "emotion": {
      "nextStep": "thought"
    },
    "thought": {
      "condition": {
        "type": "length",
        "params": {
          "minLength": 20
        }
      },
      "nextStep": "why"
    },
    "why": {
      "nextStep": "conclusion"
    }
  }
}
```

### Пример 3: Условный переход

```json
{
  "emotion": {
    "condition": {
      "type": "contains",
      "params": {
        "values": ["злость", "гнев", "раздражение"]
      }
    },
    "nextStep": "anger_management",
    "skipIfConditionFails": true
  },
  "anger_management": {
    "question": "Давайте поработаем с вашей злостью..."
  }
}
```

### Пример 4: Маршрутизация через LLM на естественном языке

```json
{
  "thought": {
    "question": "Какая мысль порождает эту эмоцию?",
    "systemPrompt": "...",
    "condition": {
      "type": "llm-routing",
      "params": {
        "routingCondition": "если пользователь ввел emotion и thought, то перейди на why степ"
      }
    }
  },
  "why": {
    "question": "Почему вы так думаете?"
  }
}
```

Более сложный пример с анализом контекста:

```json
{
  "emotion": {
    "condition": {
      "type": "llm-routing",
      "params": {
        "routingCondition": "если эмоция очень негативная (грусть, злость, страх, отчаяние) и проблема связана с работой, перейди на work_stress_step, иначе на thought"
      }
    },
    "errorMessage": "Не удалось определить маршрут"
  }
}
```

## Примечания

- Условия проверяются перед выполнением шага
- Если `skipIfConditionFails: true`, шаг пропускается, если условие не выполнено
- Если условие не выполнено и `skipIfConditionFails` не установлен, пользователю показывается ошибка
- Порядок шагов можно задать через `stepOrder` или через `nextStep` в каждом шаге
