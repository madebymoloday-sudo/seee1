import { ChatOpenAI } from "@langchain/openai";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PipelineState, PipelineStep } from "./pipeline.types";
import {
  ProgramConfig,
  ProgramLoaderService,
  StepCondition,
} from "./program-loader.service";

@Injectable()
export class PipelineService implements OnModuleInit {
  private llmCache: Map<string, ChatOpenAI> = new Map();
  private readonly logger = new Logger(PipelineService.name);
  private llmAvailable: boolean = false;

  constructor(
    private configService: ConfigService,
    private programLoader: ProgramLoaderService
  ) {}

  /**
   * Получить LLM для программы (с кэшированием)
   */
  private getLLMForProgram(program: ProgramConfig): ChatOpenAI {
    const cacheKey = `${program.name}-${program.version}`;

    if (this.llmCache.has(cacheKey)) {
      return this.llmCache.get(cacheKey)!;
    }

    const settings = program.settings || {};
    const llm = new ChatOpenAI({
      modelName: settings.model || "gpt-4o-mini",
      temperature: settings.temperature || 0.7,
      maxTokens: settings.maxTokens || 500,
      openAIApiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });

    this.llmCache.set(cacheKey, llm);
    return llm;
  }

  /**
   * Получить программу по имени
   */
  getProgram(programName: string = "default"): ProgramConfig | null {
    return this.programLoader.getProgram(programName);
  }

  /**
   * Получить список доступных программ
   */
  listAvailablePrograms() {
    return this.programLoader.listPrograms();
  }

  /**
   * Проверка доступности LLM при старте модуля
   */
  async onModuleInit() {
    await this.checkLLMAvailability();
  }

  /**
   * Проверка доступности LLM
   */
  async checkLLMAvailability(): Promise<boolean> {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");

    if (!apiKey || apiKey === "your-openai-api-key" || apiKey.trim() === "") {
      this.logger.warn(
        "⚠️  LLM не настроен: OPENAI_API_KEY не задан или имеет значение по умолчанию"
      );
      this.logger.warn(
        "   Для использования AI-психолога установите переменную окружения OPENAI_API_KEY"
      );
      this.llmAvailable = false;
      return false;
    }

    try {
      // Пробуем создать простой LLM экземпляр и сделать тестовый запрос
      const testLLM = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 10,
        openAIApiKey: apiKey,
      });

      // Делаем минимальный тестовый запрос
      const response = await testLLM.invoke("Hi");

      this.logger.log("✅ LLM успешно подключен и работает");
      this.logger.log(`   Модель: gpt-4o-mini`);
      this.logger.log(
        `   API ключ: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`
      );
      this.llmAvailable = true;
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      this.logger.error("❌ LLM недоступен:", errorMessage);
      this.logger.warn(
        "   Проверьте правильность OPENAI_API_KEY и доступность OpenAI API"
      );
      this.llmAvailable = false;
      return false;
    }
  }

  /**
   * Проверить доступность LLM
   */
  isLLMAvailable(): boolean {
    return this.llmAvailable;
  }

  private interpolatePrompt(template: string, state: PipelineState): string {
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

  private extractIdeas(text: string): string[] {
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
    const purposes: string[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.match(/^[-•]\s|^[0-9]+\.|может быть|возможно|или/i)) {
        purposes.push(line.replace(/^[-•]\s|^[0-9]+\.\s/, "").trim());
      }
    }
    return purposes.length > 0 ? purposes : [text];
  }

  /**
   * Проверка условия шага
   */
  private async checkCondition(
    condition: StepCondition,
    state: PipelineState,
    userMessage?: string,
    llm?: ChatOpenAI
  ): Promise<{ passed: boolean; error?: string }> {
    const { type, params = {}, errorMessage } = condition;

    try {
      switch (type) {
        case "exists": {
          // Проверка существования переменной в состоянии
          const variableName = params.variable;
          if (!variableName) {
            return { passed: false, error: "Variable name not specified" };
          }
          const value = (state as any)[variableName];
          const passed = value !== undefined && value !== null && value !== "";
          return {
            passed,
            error: passed
              ? undefined
              : errorMessage || `Variable '${variableName}' is required`,
          };
        }

        case "length": {
          // Проверка длины сообщения пользователя
          if (!userMessage) {
            return {
              passed: false,
              error: "User message required for length check",
            };
          }
          const length = userMessage.trim().length;
          const minLength = params.minLength ?? 0;
          const maxLength = params.maxLength ?? Infinity;
          const passed = length >= minLength && length <= maxLength;
          return {
            passed,
            error: passed
              ? undefined
              : errorMessage ||
                `Message length must be between ${minLength} and ${maxLength} characters`,
          };
        }

        case "contains": {
          // Проверка наличия определенных значений в сообщении
          if (!userMessage) {
            return {
              passed: false,
              error: "User message required for contains check",
            };
          }
          const values = Array.isArray(params.values)
            ? params.values
            : [params.values].filter(Boolean);
          if (values.length === 0) {
            return {
              passed: false,
              error: "No values specified for contains check",
            };
          }
          const messageLower = userMessage.toLowerCase();
          const passed = values.some((val) =>
            messageLower.includes(val.toLowerCase())
          );
          return {
            passed,
            error: passed
              ? undefined
              : errorMessage ||
                `Message must contain one of: ${values.join(", ")}`,
          };
        }

        case "regex": {
          // Проверка по регулярному выражению
          if (!userMessage) {
            return {
              passed: false,
              error: "User message required for regex check",
            };
          }
          const pattern = params.pattern;
          if (!pattern) {
            return { passed: false, error: "Regex pattern not specified" };
          }
          try {
            const regex = new RegExp(pattern, "i");
            const passed = regex.test(userMessage);
            return {
              passed,
              error: passed
                ? undefined
                : errorMessage || `Message does not match pattern: ${pattern}`,
            };
          } catch (error) {
            return {
              passed: false,
              error: `Invalid regex pattern: ${pattern}`,
            };
          }
        }

        case "llm-check": {
          // Проверка через LLM
          if (!llm) {
            return { passed: false, error: "LLM required for llm-check" };
          }
          if (!userMessage) {
            return {
              passed: false,
              error: "User message required for llm-check",
            };
          }
          const prompt =
            params.llmPrompt ||
            "Does this message meet the requirements? Answer only yes or no.";
          try {
            const response = await llm.invoke([
              {
                role: "system",
                content: prompt,
              },
              {
                role: "user",
                content: userMessage,
              },
            ]);
            const content = (response.content as string).toLowerCase().trim();
            const passed =
              content.startsWith("yes") || content.startsWith("да");
            return {
              passed,
              error: passed
                ? undefined
                : errorMessage || "Message does not meet the requirements",
            };
          } catch (error) {
            this.logger.error("Error in LLM condition check:", error);
            return {
              passed: false,
              error: "Error checking condition with LLM",
            };
          }
        }

        case "llm-routing": {
          // Маршрутизация через LLM на основе условия на естественном языке
          if (!llm) {
            return { passed: false, error: "LLM required for llm-routing" };
          }
          const routingCondition = params.routingCondition;
          if (!routingCondition) {
            return {
              passed: false,
              error: "Routing condition not specified",
            };
          }

          try {
            // Формируем контекст о текущем состоянии
            const stateContext = this.buildStateContext(state);

            // Добавляем последний ответ пользователя, если он есть
            const userMessageContext = userMessage
              ? `\nПоследний ответ пользователя: "${userMessage}"`
              : "";

            const routingPrompt = `Ты помогаешь определять маршрутизацию в диалоге психолога.

Текущее состояние диалога:
${stateContext}${userMessageContext}

Условие маршрутизации: "${routingCondition}"

Проанализируй условие и текущее состояние. ОПРЕДЕЛИ СЛЕДУЮЩИЙ ШАГ ДЛЯ ПЕРЕХОДА.

ВАЖНО:
- Всегда указывай nextStep (название шага), даже если условие не выполнено
- Если условие выполнено - укажи шаг из условия (then-ветвь, например work_stress_step)
- Если условие НЕ выполнено - укажи шаг из else-ветви (если есть, например thought) или следующий стандартный шаг
- passed должен быть true только если выполнено основное условие (then-ветвь)
- Используй точные названия шагов из условия (например work_stress_step, thought)

Ответь СТРОГО в формате JSON:
{
  "passed": true/false,
  "nextStep": "название_шага",
  "reason": "краткое объяснение (опционально)"
}`;

            const response = await llm.invoke([
              {
                role: "system",
                content: routingPrompt,
              },
            ]);

            const content = (response.content as string).trim();
            // Пытаемся извлечь JSON из ответа
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              this.logger.warn(
                "LLM routing: Could not parse JSON from response",
                content
              );
              return {
                passed: false,
                error: "Could not parse routing response",
              };
            }

            const routingResult = JSON.parse(jsonMatch[0]);
            const passed = routingResult.passed === true;

            // Сохраняем информацию о следующем шаге в состоянии (для использования в getNextStep)
            // Важно: сохраняем nextStep независимо от passed, так как LLM может указать шаг даже если условие не выполнено
            if (routingResult.nextStep) {
              (state as any)._llmRoutingNextStep = routingResult.nextStep;
            }

            // Для llm-routing считаем условие выполненным, если LLM указал nextStep
            // Это позволяет использовать else-ветви в условиях маршрутизации
            const conditionPassed =
              passed ||
              (routingResult.nextStep !== null &&
                routingResult.nextStep !== undefined);

            return {
              passed: conditionPassed,
              // Не показываем технические объяснения пользователю
              error: conditionPassed
                ? undefined
                : errorMessage || "Не удалось определить следующий шаг",
            };
          } catch (error: any) {
            this.logger.error("Error in LLM routing condition:", error);
            return {
              passed: false,
              error: "Error checking routing condition with LLM",
            };
          }
        }

        default:
          return { passed: false, error: `Unknown condition type: ${type}` };
      }
    } catch (error) {
      this.logger.error("Error checking condition:", error);
      return { passed: false, error: "Error checking condition" };
    }
  }

  /**
   * Построить контекст состояния для LLM
   */
  private buildStateContext(state: PipelineState): string {
    const context: string[] = [];

    if (state.problem) context.push(`- Проблема (problem): "${state.problem}"`);
    if (state.emotion) context.push(`- Эмоция (emotion): "${state.emotion}"`);
    if (state.thought) context.push(`- Мысль (thought): "${state.thought}"`);
    if (state.whyAnswer)
      context.push(`- Ответ на "почему" (whyAnswer): "${state.whyAnswer}"`);
    if (state.botIdeas && state.botIdeas.length > 0) {
      context.push(`- Идеи бота (botIdeas): ${state.botIdeas.join(", ")}`);
    }
    if (state.founder)
      context.push(`- Основатель (founder): "${state.founder}"`);
    if (state.purposeOptions && state.purposeOptions.length > 0) {
      context.push(
        `- Варианты целей (purposeOptions): ${state.purposeOptions.join(", ")}`
      );
    }
    if (state.consequences && state.consequences.length > 0) {
      context.push(
        `- Последствия (consequences): ${state.consequences.join(", ")}`
      );
    }
    if (state.conclusion)
      context.push(`- Вывод (conclusion): "${state.conclusion}"`);

    context.push(`- Текущий шаг (currentStep): ${state.currentStep}`);

    return context.length > 0 ? context.join("\n") : "Состояние пустое";
  }

  /**
   * Получить следующий шаг с учетом условий
   */
  private getNextStep(
    currentStepName: string,
    program: ProgramConfig,
    state: PipelineState
  ): string | null {
    const stepConfig = program.steps[currentStepName];

    // Если LLM определил следующий шаг через маршрутизацию, используем его
    if ((state as any)._llmRoutingNextStep) {
      const llmNextStep = (state as any)._llmRoutingNextStep;
      delete (state as any)._llmRoutingNextStep; // Очищаем после использования
      // Проверяем, что шаг существует в программе
      if (program.steps[llmNextStep]) {
        return llmNextStep;
      } else {
        this.logger.warn(
          `LLM routing suggested step '${llmNextStep}' which doesn't exist in program`
        );
      }
    }

    // Если в конфигурации шага указан nextStep, используем его
    if (stepConfig?.nextStep) {
      return stepConfig.nextStep;
    }

    // Если в программе указан порядок шагов, используем его
    if (program.stepOrder && Array.isArray(program.stepOrder)) {
      const currentIndex = program.stepOrder.indexOf(currentStepName);
      if (currentIndex >= 0 && currentIndex < program.stepOrder.length - 1) {
        return program.stepOrder[currentIndex + 1];
      }
      return null;
    }

    // Иначе используем порядок из объекта steps
    const stepNames = Object.keys(program.steps);
    const currentIndex = stepNames.indexOf(currentStepName);
    if (currentIndex >= 0 && currentIndex < stepNames.length - 1) {
      return stepNames[currentIndex + 1];
    }

    return null;
  }

  async processMessage(
    sessionId: string,
    userMessage: string,
    currentState?: PipelineState,
    programName?: string
  ): Promise<{ message: string; state: PipelineState }> {
    let state: PipelineState =
      currentState ||
      ({
        sessionId,
        programName: programName || "default",
        currentStep: PipelineStep.PROBLEM,
        completed: false,
      } as PipelineState);

    // Определяем программу для использования
    const targetProgramName = programName || state.programName || "default";
    state.programName = targetProgramName;

    // Загружаем программу
    const program = this.getProgram(targetProgramName);
    if (!program) {
      throw new Error(`Program '${targetProgramName}' not found`);
    }

    // Получаем LLM для этой программы
    const llm = this.getLLMForProgram(program);

    // Если это первое сообщение - генерируем первый вопрос
    if (!currentState && state.currentStep === PipelineStep.PROBLEM) {
      const firstQuestion = await this.askProblem(state, program, llm);
      return {
        message: firstQuestion.message || "",
        state: firstQuestion,
      };
    }

    // Обрабатываем ответ пользователя и переходим к следующему шагу
    // Используем универсальную логику для обработки шагов с поддержкой условий
    const currentStepName = state.currentStep.toString();
    const currentStepConfig = program.steps[currentStepName];

    if (!currentStepConfig) {
      throw new Error(`Step '${currentStepName}' not found in program`);
    }

    // Сохраняем ответ пользователя в состояние ДО проверки условий маршрутизации
    // Это нужно, чтобы llm-routing мог видеть актуальное состояние
    this.saveUserResponse(state, currentStepName, userMessage);

    // Проверяем условие для текущего шага, если оно есть
    // Теперь состояние уже содержит ответ пользователя
    if (currentStepConfig.condition) {
      const conditionResult = await this.checkCondition(
        currentStepConfig.condition,
        state,
        userMessage,
        llm
      );

      if (!conditionResult.passed) {
        // Для llm-routing: если условие не выполнено, но LLM определил nextStep,
        // считаем это валидным переходом и продолжаем выполнение
        if (
          currentStepConfig.condition.type === "llm-routing" &&
          (state as any)._llmRoutingNextStep
        ) {
          // LLM определил маршрут, продолжаем
        } else if (!currentStepConfig.skipIfConditionFails) {
          // Если условие не выполнено и не нужно пропускать шаг
          return {
            message:
              conditionResult.error ||
              "Ответ не соответствует требованиям. Пожалуйста, попробуйте еще раз.",
            state: state,
          };
        }
        // Если нужно пропустить шаг при невыполнении условия, продолжаем
      }
    }

    // Получаем следующий шаг с учетом условий
    const nextStepName = this.getNextStep(currentStepName, program, state);

    if (!nextStepName) {
      // Если следующего шага нет, завершаем пайплайн
      state.completed = true;
      return {
        message:
          "Спасибо за ваши ответы! Мы завершили разбор. Вы можете сохранить результаты в нейрокарту.",
        state: state,
      };
    }

    // Переходим к следующему шагу
    const nextStepConfig = program.steps[nextStepName];
    if (!nextStepConfig) {
      throw new Error(`Next step '${nextStepName}' not found in program`);
    }

    // Проверяем условие для следующего шага (если нужно)
    if (nextStepConfig.condition) {
      const nextConditionResult = await this.checkCondition(
        nextStepConfig.condition,
        state,
        undefined, // userMessage не нужен для проверки следующего шага
        llm
      );

      if (!nextConditionResult.passed) {
        // Если условие не выполнено и нужно пропустить шаг
        if (nextStepConfig.skipIfConditionFails) {
          // Пропускаем этот шаг и ищем следующий
          const skippedNextStep = this.getNextStep(
            nextStepName,
            program,
            state
          );
          if (skippedNextStep) {
            return this.processStep(skippedNextStep, state, program, llm);
          }
        } else {
          // Продолжаем, но условие может провериться позже
        }
      }
    }

    // Выполняем следующий шаг
    return this.processStep(nextStepName, state, program, llm);
  }

  /**
   * Сохранить ответ пользователя в состояние
   */
  private saveUserResponse(
    state: PipelineState,
    stepName: string,
    userMessage: string
  ): void {
    switch (stepName) {
      case "problem":
        state.problem = userMessage;
        break;
      case "emotion":
        state.emotion = userMessage;
        break;
      case "thought":
        state.thought = userMessage;
        break;
      case "why":
        state.whyAnswer = userMessage;
        break;
      case "founder":
        state.founder = userMessage;
        break;
      case "consequences":
        state.consequences = [userMessage];
        break;
      case "conclusion":
        state.conclusion = userMessage;
        break;
    }
  }

  /**
   * Обработать конкретный шаг
   */
  private async processStep(
    stepName: string,
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<{ message: string; state: PipelineState }> {
    // Обновляем текущий шаг в состоянии
    (state as any).currentStep = stepName as PipelineStep;

    // Используем существующие методы для обработки шагов
    switch (stepName) {
      case "problem":
        return {
          message: (await this.askProblem(state, program, llm)).message || "",
          state,
        };
      case "emotion":
        return {
          message: (await this.askEmotion(state, program, llm)).message || "",
          state,
        };
      case "thought":
        return {
          message: (await this.askThought(state, program, llm)).message || "",
          state,
        };
      case "why":
        return {
          message: (await this.askWhy(state, program, llm)).message || "",
          state,
        };
      case "ideas":
        return {
          message: (await this.suggestIdeas(state, program, llm)).message || "",
          state,
        };
      case "founder":
        return {
          message: (await this.askFounder(state, program, llm)).message || "",
          state,
        };
      case "purpose":
        return {
          message: (await this.askPurpose(state, program, llm)).message || "",
          state,
        };
      case "consequences":
        return {
          message:
            (await this.askConsequences(state, program, llm)).message || "",
          state,
        };
      case "conclusion":
        return {
          message:
            (await this.askConclusion(state, program, llm)).message || "",
          state,
        };
      default:
        // Универсальная обработка для кастомных шагов (например, work_stress_step)
        return this.processGenericStep(stepName, state, program, llm);
    }
  }

  /**
   * Универсальная обработка шага для кастомных шагов
   */
  private async processGenericStep(
    stepName: string,
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<{ message: string; state: PipelineState }> {
    const stepConfig = program.steps[stepName];
    if (!stepConfig) {
      throw new Error(`Step '${stepName}' not found in program`);
    }

    // Обновляем текущий шаг в состоянии
    const updatedState = {
      ...state,
      currentStep: stepName as PipelineStep,
      programName: program.name,
    };

    // Если есть systemPrompt, используем LLM для генерации ответа
    if (stepConfig.systemPrompt) {
      const systemPrompt = this.interpolatePrompt(
        stepConfig.systemPrompt,
        state
      );
      const message = await llm.invoke([
        { role: "system", content: systemPrompt },
      ]);
      return {
        message: message.content as string,
        state: {
          ...updatedState,
          message: message.content as string,
        },
      };
    }

    // Если нет systemPrompt, но есть question, возвращаем его напрямую
    if (stepConfig.question) {
      return {
        message: stepConfig.question,
        state: {
          ...updatedState,
          message: stepConfig.question,
        },
      };
    }

    // Если ни того, ни другого нет - ошибка
    throw new Error(
      `Step '${stepName}' must have either 'systemPrompt' or 'question'`
    );
  }

  private async askProblem(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.problem;
    if (!stepConfig) {
      throw new Error('Step "problem" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.PROBLEM,
      message: message.content as string,
    };
  }

  private async askEmotion(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.emotion;
    if (!stepConfig) {
      throw new Error('Step "emotion" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.EMOTION,
      message: message.content as string,
    };
  }

  private async askThought(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.thought;
    if (!stepConfig) {
      throw new Error('Step "thought" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.THOUGHT,
      message: message.content as string,
    };
  }

  private async askWhy(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.why;
    if (!stepConfig) {
      throw new Error('Step "why" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.WHY,
      message: message.content as string,
    };
  }

  private async suggestIdeas(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.ideas;
    if (!stepConfig) {
      throw new Error('Step "ideas" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    const ideas = this.extractIdeas(message.content as string);
    return {
      ...state,
      currentStep: PipelineStep.IDEAS,
      botIdeas: ideas,
      message: message.content as string,
    };
  }

  private async askFounder(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.founder;
    if (!stepConfig) {
      throw new Error('Step "founder" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.FOUNDER,
      message: message.content as string,
    };
  }

  private async askPurpose(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.purpose;
    if (!stepConfig) {
      throw new Error('Step "purpose" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    const purposes = this.extractPurposeOptions(message.content as string);
    return {
      ...state,
      currentStep: PipelineStep.PURPOSE,
      purposeOptions: purposes,
      message: message.content as string,
    };
  }

  private async askConsequences(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.consequences;
    if (!stepConfig) {
      throw new Error('Step "consequences" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.CONSEQUENCES,
      message: message.content as string,
    };
  }

  private async askConclusion(
    state: PipelineState,
    program: ProgramConfig,
    llm: ChatOpenAI
  ): Promise<PipelineState> {
    const stepConfig = program.steps.conclusion;
    if (!stepConfig) {
      throw new Error('Step "conclusion" not found in program');
    }
    const systemPrompt = this.interpolatePrompt(stepConfig.systemPrompt, state);
    const message = await llm.invoke([
      { role: "system", content: systemPrompt },
    ]);
    return {
      ...state,
      currentStep: PipelineStep.CONCLUSION,
      message: message.content as string,
    };
  }
}
