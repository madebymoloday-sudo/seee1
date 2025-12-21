# Пайплайн работы AI-психолога

## Обзор

Структурированный пайплайн из 9 шагов для работы AI-психолога с пользователем. Пайплайн реализуется через LangGraph.js в Node.js/NestJS и интегрируется в существующий WebSocket чат.

---

## Структура пайплайна

### Шаги пайплайна:

1. **Описание проблемы** (`PROBLEM`)

   - Вопрос: "Опишите вашу проблему. Что вас беспокоит или тревожит?"
   - Цель: Получить описание ситуации от пользователя

2. **Эмоция от проблемы** (`EMOTION`)

   - Вопрос: "Какую эмоцию вызывает у вас эта проблема?"
   - Цель: Выявить эмоциональную реакцию на проблему

3. **Мысль, порождающая эмоцию** (`THOUGHT`)

   - Вопрос: "Какая мысль порождает эту эмоцию? Какое убеждение или идея стоит за этим чувством?"
   - Цель: Найти корневую мысль/убеждение

4. **Почему?** (`WHY`)

   - Вопрос: "Почему вы так думаете? Откуда взялась эта мысль?"
   - Цель: Понять источник убеждения

5. **Идеи от бота** (`IDEAS`)

   - Действие: Бот предлагает 2-3 альтернативные идеи или интерпретации
   - Формат: "Может быть, эта мысль появилась потому что...", "Возможно, стоит рассмотреть идею о том, что...", "А что если на самом деле..."
   - Цель: Расширить перспективу пользователя

6. **Основатель идеи** (`FOUNDER`)

   - Вопрос: "Кто может быть основателем этой идеи? Кому было выгодно, чтобы такая мысль появилась?"
   - Цель: Определить источник идеи (всегда один человек)

7. **Цель (эгоистичная)** (`PURPOSE`)

   - Вопрос: "С какой целью этот человек мог это делать? Предложи пару вариантов, включая эгоистичные мотивы."
   - Формат: 2-3 варианта, включая эгоистичные цели
   - Примеры: "Может быть, чтобы...", "Возможно, для того чтобы...", "Или чтобы..."
   - Цель: Понять мотивы основателя идеи (всегда один человек)

8. **Эмоциональные последствия** (`CONSEQUENCES`)

   - Вопрос: "Какие могут быть эмоциональные последствия от этой идеи? Как она влияет на ваши чувства?"
   - Цель: Осознать влияние идеи на эмоциональное состояние

9. **Вывод пользователя** (`CONCLUSION`)
   - Вопрос: "Какой твой вывод? Что ты понял из этого разбора?"
   - Цель: Помочь пользователю сделать осознанный вывод

---

## Конфигурация вопросов через JSON

### Файл pipeline-questions.json

Все вопросы и промпты для каждого шага пайплайна хранятся в отдельном JSON файле `pipeline-questions.json`. Это позволяет:

- ✅ Менять формулировки вопросов без изменения кода
- ✅ Настраивать промпты для GPT без перекомпиляции
- ✅ Легко локализовать вопросы (поддержка разных языков)
- ✅ A/B тестирование разных формулировок

### Структура JSON файла

```json
{
  "steps": {
    "problem": {
      "question": "Опишите вашу проблему...",
      "systemPrompt": "Ты профессиональный психолог..."
    },
    "emotion": {
      "question": "Какую эмоцию вызывает...",
      "systemPrompt": "Пользователь описал проблему..."
    }
    // ... остальные шаги
  },
  "variables": {
    "problem": "Проблема пользователя",
    "emotion": "Эмоция пользователя"
    // ... описание переменных для подстановки
  },
  "settings": {
    "temperature": 0.7,
    "maxTokens": 500,
    "model": "gpt-4o-mini"
  }
}
```

### Подстановка переменных

В промптах можно использовать переменные в фигурных скобках:

- `{problem}` - подставится значение `state.problem`
- `{emotion}` - подставится значение `state.emotion`
- `{thought}` - подставится значение `state.thought`
- и т.д.

### Загрузка конфигурации

Сервис автоматически загружает JSON файл при инициализации и использует его для генерации вопросов.

---

## Техническая реализация

### Использование LangGraph.js

Пайплайн реализуется через LangGraph.js для Node.js, что позволяет:

- Управлять состоянием между шагами
- Создавать граф переходов
- Сохранять контекст диалога
- Легко добавлять условные переходы

### Структура состояния

```typescript
enum PipelineStep {
  PROBLEM = "problem",
  EMOTION = "emotion",
  THOUGHT = "thought",
  WHY = "why",
  IDEAS = "ideas",
  FOUNDER = "founder",
  PURPOSE = "purpose",
  CONSEQUENCES = "consequences",
  CONCLUSION = "conclusion",
}

interface PipelineState {
  sessionId: string;
  currentStep: PipelineStep;
  problem?: string;
  emotion?: string;
  thought?: string;
  whyAnswer?: string;
  botIdeas?: string[];
  founder?: string;
  purposeOptions?: string[];
  consequences?: string[];
  conclusion?: string;
  completed: boolean;
}
```

---

## Интеграция с существующим чатом

### Текущая архитектура

- ✅ WebSocket Gateway (Socket.IO) - уже есть
- ✅ Обработка сообщений - уже есть
- ✅ Сохранение в БД - уже есть
- ✅ Интеграция с AI - уже есть

### Что нужно добавить

1. **Сервис пайплайна** (`PsychologistPipelineService`)

   - Реализация графа через LangGraph.js
   - Обработка каждого шага
   - Генерация вопросов через GPT

2. **Таблица для состояния** (`pipeline_states`)

   - Хранение состояния пайплайна для каждой сессии
   - JSON поле для гибкости

3. **Интеграция в WebSocket Gateway**
   - Использование пайплайна вместо прямого вызова GPT
   - Сохранение состояния после каждого шага
   - Сохранение концепций при завершении

---

## Схема базы данных

### Таблица pipeline_states

```prisma
model PipelineState {
  id        String   @id @default(uuid())
  sessionId String   @unique @map("session_id")
  stateJson Json     @map("state_json") // JSON с состоянием пайплайна

  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("pipeline_states")
}
```

### Обновление модели Session

```prisma
model Session {
  // ... существующие поля
  pipelineState PipelineState?
}
```

---

## Реализация сервиса

### PsychologistPipelineService

```typescript
// psychologist/psychologist-pipeline.service.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PsychologistPipelineService {
  private graph: StateGraph;
  private llm: ChatOpenAI;
  private questionsConfig: any;

  constructor(
    private configService: ConfigService,
    @Inject("QUESTIONS_CONFIG") questionsConfig?: any
  ) {
    // Загружаем конфигурацию вопросов
    this.questionsConfig = questionsConfig || this.loadQuestionsConfig();

    this.llm = new ChatOpenAI({
      modelName: this.questionsConfig.settings?.model || "gpt-4o-mini",
      temperature: this.questionsConfig.settings?.temperature || 0.7,
      openAIApiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });

    this.buildGraph();
  }

  private loadQuestionsConfig(): any {
    try {
      const fs = require("fs");
      const path = require("path");
      const configPath = path.join(
        process.cwd(),
        "config",
        "pipeline-questions.json"
      );
      const configData = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(configData);
    } catch (error) {
      console.error("Ошибка загрузки конфигурации вопросов:", error);
      // Возвращаем дефолтную конфигурацию
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): any {
    // Дефолтная конфигурация, если файл не найден
    return {
      steps: {
        problem: {
          question: "Опишите вашу проблему. Что вас беспокоит или тревожит?",
          systemPrompt:
            'Ты профессиональный психолог. Начни диалог мягко и эмпатично.\n\nЗадай вопрос: "Опишите вашу проблему. Что вас беспокоит или тревожит?"\n\nБудь мягким, поддерживающим. Не давай советы, просто задай вопрос.',
        },
        // ... остальные шаги
      },
      settings: {
        temperature: 0.7,
        model: "gpt-4o-mini",
      },
    };
  }

  private interpolatePrompt(template: string, state: PipelineState): string {
    // Подстановка переменных в промпт
    return template
      .replace(/{problem}/g, state.problem || "")
      .replace(/{emotion}/g, state.emotion || "")
      .replace(/{thought}/g, state.thought || "")
      .replace(/{whyAnswer}/g, state.whyAnswer || "")
      .replace(/{botIdeas}/g, state.botIdeas?.join(", ") || "")
      .replace(/{founder}/g, state.founder || "")
      .replace(/{purposeOptions}/g, state.purposeOptions?.join(", ") || "")
      .replace(/{consequences}/g, state.consequences?.join(", ") || "");
  }

  private buildGraph() {
    // Граф используется для визуализации потока, но фактическая логика
    // переходов реализована в processMessage для большей гибкости
    // при работе с пользовательскими сообщениями
    this.graph = new StateGraph({
      channels: {
        sessionId: "",
        currentStep: PipelineStep.PROBLEM,
        problem: null,
        emotion: null,
        thought: null,
        whyAnswer: null,
        botIdeas: null,
        founder: null,
        purposeOptions: null,
        consequences: null,
        conclusion: null,
        completed: false,
        message: "",
      },
    })
      .addNode("ask_problem", this.askProblem.bind(this))
      .addNode("ask_emotion", this.askEmotion.bind(this))
      .addNode("ask_thought", this.askThought.bind(this))
      .addNode("ask_why", this.askWhy.bind(this))
      .addNode("suggest_ideas", this.suggestIdeas.bind(this))
      .addNode("ask_founder", this.askFounder.bind(this))
      .addNode("ask_purpose", this.askPurpose.bind(this))
      .addNode("ask_consequences", this.askConsequences.bind(this))
      .addNode("ask_conclusion", this.askConclusion.bind(this))
      .addEdge(START, "ask_problem")
      .addEdge("ask_problem", "ask_emotion")
      .addEdge("ask_emotion", "ask_thought")
      .addEdge("ask_thought", "ask_why")
      .addEdge("ask_why", "suggest_ideas")
      .addEdge("suggest_ideas", "ask_founder")
      .addEdge("ask_founder", "ask_purpose")
      .addEdge("ask_purpose", "ask_consequences")
      .addEdge("ask_consequences", "ask_conclusion")
      .addEdge("ask_conclusion", END);
  }

  // Шаг 1: Описание проблемы
  private async askProblem(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.problem;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.PROBLEM,
      message: message.content,
    };
  }

  // Шаг 2: Эмоция от проблемы
  private async askEmotion(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.emotion;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.EMOTION,
      message: message.content,
    };
  }

  // Шаг 3: Мысль, порождающая эмоцию
  private async askThought(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.thought;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.THOUGHT,
      message: message.content,
    };
  }

  // Шаг 4: Почему?
  private async askWhy(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.why;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.WHY,
      message: message.content,
    };
  }

  // Шаг 5: Идеи от бота
  private async suggestIdeas(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.ideas;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    // Извлекаем идеи из ответа
    const ideas = this.extractIdeas(message.content);

    return {
      ...state,
      currentStep: PipelineStep.IDEAS,
      botIdeas: ideas,
      message: message.content,
    };
  }

  // Шаг 6: Основатель идеи
  private async askFounder(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.founder;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.FOUNDER,
      message: message.content,
    };
  }

  // Шаг 7: Цель (эгоистичная)
  private async askPurpose(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.purpose;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    // Извлекаем варианты целей
    const purposes = this.extractPurposeOptions(message.content);

    return {
      ...state,
      currentStep: PipelineStep.PURPOSE,
      purposeOptions: purposes,
      message: message.content,
    };
  }

  // Шаг 8: Эмоциональные последствия
  private async askConsequences(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.consequences;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.CONSEQUENCES,
      message: message.content,
    };
  }

  // Шаг 9: Вывод пользователя
  private async askConclusion(state: PipelineState) {
    const stepConfig = this.questionsConfig.steps.conclusion;
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);

    const message = await this.llm.invoke([
      {
        role: "system",
        content: systemPrompt,
      },
    ]);

    return {
      ...state,
      currentStep: PipelineStep.CONCLUSION,
      message: message.content,
    };
  }

  // Вспомогательные методы
  private extractIdeas(text: string): string[] {
    // Парсим идеи из текста (можно улучшить через GPT)
    const ideas: string[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.match(/^[-•]\s|^[0-9]+\./)) {
        ideas.push(line.replace(/^[-•]\s|^[0-9]+\.\s/, "").trim());
      }
    }
    return ideas.length > 0 ? ideas : [text];
  }

  private extractPurposeOptions(text: string): string[] {
    // Парсим варианты целей
    const purposes: string[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.match(/^[-•]\s|^[0-9]+\.|может быть|возможно|или/)) {
        purposes.push(line.replace(/^[-•]\s|^[0-9]+\.\s/, "").trim());
      }
    }
    return purposes.length > 0 ? purposes : [text];
  }

  // Публичный метод для обработки сообщения
  async processMessage(
    sessionId: string,
    userMessage: string,
    currentState?: PipelineState
  ): Promise<{ message: string; state: PipelineState }> {
    let state: PipelineState = currentState || {
      sessionId,
      currentStep: PipelineStep.PROBLEM,
      completed: false,
    };

    // Если это первое сообщение в новой сессии - генерируем первый вопрос
    if (!currentState && state.currentStep === PipelineStep.PROBLEM) {
      const firstQuestion = await this.askProblem(state);
      return {
        message: firstQuestion.message,
        state: firstQuestion,
      };
    }

    // Обновляем состояние на основе ответа пользователя
    if (state.currentStep === PipelineStep.PROBLEM) {
      state.problem = userMessage;
      // Переходим к следующему шагу - эмоция
      const nextStep = await this.askEmotion(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.EMOTION) {
      state.emotion = userMessage;
      // Переходим к следующему шагу - мысль
      const nextStep = await this.askThought(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.THOUGHT) {
      state.thought = userMessage;
      // Переходим к следующему шагу - почему
      const nextStep = await this.askWhy(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.WHY) {
      state.whyAnswer = userMessage;
      // Переходим к следующему шагу - идеи от бота
      const nextStep = await this.suggestIdeas(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.IDEAS) {
      // После предложения идей переходим к основателю
      const nextStep = await this.askFounder(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.FOUNDER) {
      state.founder = userMessage;
      // Переходим к следующему шагу - цель
      const nextStep = await this.askPurpose(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.PURPOSE) {
      // После предложения целей переходим к последствиям
      const nextStep = await this.askConsequences(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.CONSEQUENCES) {
      state.consequences = [userMessage];
      // Переходим к следующему шагу - вывод
      const nextStep = await this.askConclusion(state);
      return {
        message: nextStep.message,
        state: nextStep,
      };
    } else if (state.currentStep === PipelineStep.CONCLUSION) {
      state.conclusion = userMessage;
      state.completed = true;
      // Пайплайн завершен
      return {
        message:
          "Спасибо за ваши ответы! Мы завершили разбор. Вы можете сохранить результаты в нейрокарту.",
        state: state,
      };
    }

    // Fallback - не должно произойти
    return {
      message: "Что-то пошло не так. Пожалуйста, начните новую сессию.",
      state: state,
    };
  }
}
```

---

## Интеграция в WebSocket Gateway

### Обновление handleMessage

```typescript
// websocket/websocket.gateway.ts

@SubscribeMessage("message")
async handleMessage(
  @MessageBody() data: { sessionId: string; content: string },
  @ConnectedSocket() client: Socket
) {
  const { sessionId, content } = data;

  // 1. Сохраняем сообщение пользователя
  await this.prisma.message.create({
    data: {
      sessionId,
      role: "user",
      content,
    },
  });

  // 2. Получаем текущее состояние пайплайна из БД
  const pipelineState = await this.getPipelineState(sessionId);

  // 3. Обрабатываем через пайплайн
  const result = await this.pipelineService.processMessage(
    sessionId,
    content,
    pipelineState
  );

  // 4. Сохраняем ответ AI
  await this.prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      content: result.message,
    },
  });

  // 5. Сохраняем состояние пайплайна
  await this.savePipelineState(sessionId, result.state);

  // 6. Отправляем ответ клиенту
  client.emit("message", {
    sessionId,
    content: result.message,
    step: result.state.currentStep,
    completed: result.state.completed,
  });

  // 7. Если пайплайн завершен - сохраняем концепции
  if (result.state.completed) {
    await this.saveConcepts(sessionId, result.state);
  }
}

private async getPipelineState(sessionId: string): Promise<PipelineState> {
  const state = await this.prisma.pipelineState.findUnique({
    where: { sessionId },
  });

  if (state) {
    return JSON.parse(state.stateJson as string);
  }

  // Новое состояние для новой сессии
  return {
    sessionId,
    currentStep: PipelineStep.PROBLEM,
    completed: false,
  };
}

private async savePipelineState(sessionId: string, state: PipelineState) {
  await this.prisma.pipelineState.upsert({
    where: { sessionId },
    create: {
      sessionId,
      stateJson: state as any,
    },
    update: {
      stateJson: state as any,
    },
  });
}

private async saveConcepts(sessionId: string, state: PipelineState) {
  // Сохраняем в concept_hierarchies
  const conceptData = {
    problem: state.problem,
    emotion: state.emotion,
    thought: state.thought,
    whyAnswer: state.whyAnswer,
    botIdeas: state.botIdeas,
    founder: state.founder,
    purposeOptions: state.purposeOptions,
    consequences: state.consequences,
    conclusion: state.conclusion,
  };

  await this.prisma.conceptHierarchy.create({
    data: {
      sessionId,
      conceptData: conceptData as any,
    },
  });
}
```

---

## Обновление PsychologistService

### Замена прямого вызова GPT на пайплайн

```typescript
// psychologist/psychologist.service.ts

@Injectable()
export class PsychologistService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private pipelineService: PsychologistPipelineService // Добавляем пайплайн
  ) {}

  async generateResponse(
    sessionId: string,
    userMessage: string
  ): Promise<string> {
    // Используем пайплайн вместо прямого вызова GPT
    const pipelineState = await this.getPipelineState(sessionId);

    const result = await this.pipelineService.processMessage(
      sessionId,
      userMessage,
      pipelineState
    );

    // Сохраняем состояние
    await this.savePipelineState(sessionId, result.state);

    return result.message;
  }

  private async getPipelineState(sessionId: string): Promise<PipelineState> {
    const state = await this.prisma.pipelineState.findUnique({
      where: { sessionId },
    });

    if (state) {
      return JSON.parse(state.stateJson as string);
    }

    return {
      sessionId,
      currentStep: PipelineStep.PROBLEM,
      completed: false,
    };
  }

  private async savePipelineState(sessionId: string, state: PipelineState) {
    await this.prisma.pipelineState.upsert({
      where: { sessionId },
      create: {
        sessionId,
        stateJson: state as any,
      },
      update: {
        stateJson: state as any,
      },
    });
  }
}
```

---

## Модуль Psychologist

### Обновление модуля

```typescript
// psychologist/psychologist.module.ts
import { Module } from "@nestjs/common";
import { PsychologistService } from "./psychologist.service";
import { PsychologistPipelineService } from "./psychologist-pipeline.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [PsychologistService, PsychologistPipelineService],
  exports: [PsychologistService, PsychologistPipelineService],
})
export class PsychologistModule {}
```

---

## Установка зависимостей

### Package.json

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0"
  }
}
```

### Установка

```bash
npm install @langchain/langgraph @langchain/core @langchain/openai
```

### Создание конфигурационного файла

1. Создайте папку `config` в корне backend проекта
2. Скопируйте файл `pipeline-questions.json` в папку `config/`
3. При необходимости отредактируйте вопросы и промпты

```bash
mkdir -p backend/config
cp migrate/pipeline-questions.json backend/config/
```

### Обновление конфигурации без перезапуска

Для обновления вопросов без перезапуска сервера можно:

1. **Hot reload** - добавить файловый watcher для автоматической перезагрузки
2. **API endpoint** - создать endpoint для обновления конфигурации через API
3. **Переменные окружения** - использовать путь к конфигу из env

```typescript
// Пример с hot reload
import { watch } from "fs";

watch("config/pipeline-questions.json", () => {
  this.questionsConfig = this.loadQuestionsConfig();
  console.log("Конфигурация вопросов обновлена");
});
```

---

## Преимущества подхода

1. **Структурированность** - четкая последовательность из 9 шагов
2. **Stateful** - состояние сохраняется между сообщениями
3. **LangGraph.js** - управление графом состояний
4. **Интеграция** - использует существующий чат без изменений на фронтенде
5. **Типизация** - TypeScript для безопасности типов
6. **Гибкость** - легко добавлять условные переходы и валидацию

---

## Дополнительные возможности

### Возврат к предыдущим шагам

Можно добавить возможность вернуться к любому шагу:

```typescript
async goToStep(sessionId: string, step: PipelineStep) {
  const state = await this.getPipelineState(sessionId);
  state.currentStep = step;
  await this.savePipelineState(sessionId, state);
}
```

### Валидация ответов

Можно добавить валидацию ответов пользователя перед переходом к следующему шагу:

```typescript
private validateAnswer(step: PipelineStep, answer: string): boolean {
  if (step === PipelineStep.EMOTION) {
    // Проверяем, что это эмоция
    return this.isEmotion(answer);
  }
  // ... другие проверки
  return true;
}
```

### Условные переходы

Можно добавить условные переходы в зависимости от ответов:

```typescript
.addConditionalEdges("ask_why", this.shouldSuggestIdeas.bind(this))
```

---

## Roadmap реализации

### Phase 1: Базовая структура

- [ ] Создать `PsychologistPipelineService`
- [ ] Реализовать базовый граф с 9 шагами
- [ ] Добавить таблицу `pipeline_states` в Prisma схему
- [ ] Создать файл `pipeline-questions.json` с вопросами
- [ ] Реализовать загрузку конфигурации из JSON

### Phase 2: Интеграция

- [ ] Интегрировать пайплайн в `WebSocketGateway`
- [ ] Обновить `PsychologistService` для использования пайплайна
- [ ] Добавить сохранение концепций при завершении

### Phase 3: Улучшения

- [ ] Добавить валидацию ответов
- [ ] Реализовать возврат к предыдущим шагам
- [ ] Добавить условные переходы
- [ ] Улучшить извлечение идей и целей через GPT

### Phase 4: Тестирование

- [ ] Unit тесты для каждого шага
- [ ] Integration тесты для пайплайна
- [ ] E2E тесты для полного цикла

---

## Пример использования

### Поток диалога:

```
1. Бот: "Опишите вашу проблему. Что вас беспокоит или тревожит?"
   Пользователь: "Мне грустно от того, что я не могу найти работу"

2. Бот: "Какую эмоцию вызывает у вас эта проблема?"
   Пользователь: "Тревога и разочарование"

3. Бот: "Какая мысль порождает эту эмоцию?"
   Пользователь: "Я думаю, что я неудачник"

4. Бот: "Почему вы так думаете? Откуда взялась эта мысль?"
   Пользователь: "Мои родители всегда говорили, что я ничего не добьюсь"

5. Бот: "Может быть, эта мысль появилась потому что ваши родители хотели мотивировать вас через страх. Возможно, стоит рассмотреть идею о том, что их слова были их собственными страхами, а не вашей реальностью. А что если на самом деле вы просто еще не нашли свой путь?"

6. Бот: "Кто может быть основателем этой идеи?"
   Пользователь: "Мои родители"

7. Бот: "С какой целью этот человек мог это делать? Может быть, чтобы защитить вас от разочарований? Возможно, для того чтобы переложить на вас свои страхи? Или чтобы контролировать ваши решения?"

8. Бот: "Какие могут быть эмоциональные последствия от этой идеи?"
   Пользователь: "Я постоянно сомневаюсь в себе, боюсь пробовать новое"

9. Бот: "Какой твой вывод? Что ты понял из этого разбора?"
   Пользователь: "Я понял, что эта идея не моя, она была навязана мне родителями из их собственных страхов"
```

---

## Важные замечания

1. **Один вопрос за раз** - критически важно задавать только один вопрос на каждом шаге
2. **Сохранение состояния** - состояние должно сохраняться после каждого шага
3. **Эмпатия** - все вопросы должны быть мягкими и поддерживающими
4. **Гибкость** - можно адаптировать формулировки вопросов, но сохранять суть
5. **Завершение** - при завершении пайплайна все данные сохраняются в `concept_hierarchies`
6. **Первый вопрос** - при создании новой сессии автоматически генерируется первый вопрос
7. **Последовательность** - каждый ответ пользователя сохраняется и автоматически переходит к следующему шагу

## Проверка взаимодействия с пользователем

### Поток сообщений в чате:

1. **Пользователь создает новую сессию**

   - Frontend: `socket.emit("message", { sessionId, content: "..." })`
   - Backend: `getPipelineState()` возвращает `null` → создается новое состояние
   - `processMessage()` видит, что это первое сообщение → генерирует первый вопрос
   - Сохраняется сообщение пользователя в БД
   - Сохраняется ответ AI в БД
   - Сохраняется состояние пайплайна (currentStep: EMOTION)
   - Frontend получает ответ через `socket.on("message")`

2. **Пользователь отвечает на вопрос**

   - Frontend: `socket.emit("message", { sessionId, content: "..." })`
   - Backend: `getPipelineState()` загружает состояние из БД
   - `processMessage()` сохраняет ответ в соответствующее поле состояния
   - Автоматически переходит к следующему шагу и генерирует вопрос
   - Сохраняется сообщение пользователя в БД
   - Сохраняется ответ AI в БД
   - Обновляется состояние пайплайна
   - Frontend получает следующий вопрос

3. **Шаг 5 (IDEAS) - бот предлагает идеи**

   - Пользователь не отвечает на этот шаг
   - Бот автоматически генерирует идеи и переходит к шагу FOUNDER
   - Сохраняется ответ AI с идеями
   - Frontend получает сообщение с идеями и следующим вопросом

4. **Шаг 7 (PURPOSE) - бот предлагает варианты целей**

   - Пользователь не отвечает на этот шаг
   - Бот автоматически генерирует варианты и переходит к шагу CONSEQUENCES
   - Сохраняется ответ AI с вариантами
   - Frontend получает сообщение с вариантами и следующим вопросом

5. **Завершение пайплайна**
   - После ответа на последний вопрос (CONCLUSION)
   - `state.completed = true`
   - Сохраняются концепции в `concept_hierarchies`
   - Пользователь получает сообщение о завершении

### Проверка корректности:

✅ **Сообщения сохраняются** - каждое сообщение пользователя и AI сохраняется в БД
✅ **Состояние сохраняется** - состояние пайплайна обновляется после каждого шага
✅ **Переходы работают** - автоматический переход к следующему шагу после ответа
✅ **Первый вопрос** - генерируется автоматически при создании сессии
✅ **WebSocket интеграция** - все работает через существующий WebSocket Gateway
✅ **Frontend не меняется** - чат работает как обычно, пайплайн прозрачен для пользователя

---

## Связь с существующими фичами

### Нейрокарта

После завершения пайплайна данные автоматически можно добавить в нейрокарту:

- Событие: `problem`
- Эмоция: `emotion`
- Идея: `thought`

### Система убеждений

Данные из пайплайна сохраняются в `concept_hierarchies`:

- Наименование идеи: `thought`
- Основатель: `founder`
- Цель: `purposeOptions`
- Последствия: `consequences`
- Выводы: `conclusion`

### Журнал сессий

После завершения пайплайна можно предложить пользователю заполнить журнал сессии с выводом из пайплайна.
