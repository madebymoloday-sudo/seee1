import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface StepCondition {
  // Тип условия: 'exists', 'length', 'contains', 'llm-check', 'regex', 'llm-routing'
  type:
    | "exists"
    | "length"
    | "contains"
    | "llm-check"
    | "regex"
    | "llm-routing"
    | "custom";
  // Параметры условия (зависят от типа)
  params?: {
    // Для 'exists' - переменная для проверки
    variable?: string;
    // Для 'length' - минимальная/максимальная длина
    minLength?: number;
    maxLength?: number;
    // Для 'contains' - строка или массив строк для поиска
    values?: string | string[];
    // Для 'regex' - регулярное выражение
    pattern?: string;
    // Для 'llm-check' - промпт для проверки через LLM
    llmPrompt?: string;
    // Для 'llm-routing' - условие на естественном языке для маршрутизации
    // Например: "если пользователь ввел emotion, thought то перейди на why степ"
    routingCondition?: string;
    // Для 'custom' - JavaScript выражение (eval, осторожно!)
    expression?: string;
  };
  // Ошибка, если условие не выполнено
  errorMessage?: string;
}

export interface StepConfig {
  question: string | null;
  systemPrompt: string;
  // Условие для выполнения этого шага
  condition?: StepCondition;
  // Следующий шаг (если не указан, используется следующий по порядку)
  nextStep?: string;
  // Пропустить этот шаг, если условие не выполнено
  skipIfConditionFails?: boolean;
}

export interface ProgramConfig {
  name: string;
  version: string;
  description?: string;
  steps: Record<string, StepConfig>;
  variables?: Record<string, string>;
  settings: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
  // Порядок выполнения шагов (если не указан, используется порядок из объекта steps)
  stepOrder?: string[];
}

@Injectable()
export class ProgramLoaderService {
  private readonly logger = new Logger(ProgramLoaderService.name);
  private readonly programsDir: string;
  private programsCache: Map<string, ProgramConfig> = new Map();

  constructor() {
    this.programsDir = path.join(process.cwd(), "programs", "psychologist");
    this.loadAllPrograms();
  }

  /**
   * Загружает все программы из папки
   */
  private loadAllPrograms(): void {
    try {
      if (!fs.existsSync(this.programsDir)) {
        this.logger.warn(
          `Programs directory not found: ${this.programsDir}. Creating...`
        );
        fs.mkdirSync(this.programsDir, { recursive: true });
        return;
      }

      const files = fs.readdirSync(this.programsDir);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const programName = file.replace(".json", "");
          const programPath = path.join(this.programsDir, file);
          const programData = fs.readFileSync(programPath, "utf-8");
          const program: ProgramConfig = JSON.parse(programData);

          this.programsCache.set(programName, program);
          this.logger.log(
            `Loaded program: ${programName} (${program.version})`
          );
        } catch (error) {
          this.logger.error(`Error loading program ${file}:`, error);
        }
      }

      this.logger.log(
        `Loaded ${this.programsCache.size} program(s) from ${this.programsDir}`
      );
    } catch (error) {
      this.logger.error("Error loading programs:", error);
    }
  }

  /**
   * Получить программу по имени
   */
  getProgram(programName: string = "default"): ProgramConfig | null {
    // Перезагружаем программы при каждом запросе (для hot reload в dev)
    if (process.env.NODE_ENV === "development") {
      this.loadAllPrograms();
    }

    const program = this.programsCache.get(programName);
    if (!program) {
      this.logger.warn(`Program '${programName}' not found, using default`);
      return this.programsCache.get("default") || null;
    }

    return program;
  }

  /**
   * Получить список всех доступных программ
   */
  listPrograms(): Array<{
    name: string;
    version: string;
    description?: string;
  }> {
    return Array.from(this.programsCache.values()).map((program) => ({
      name: program.name,
      version: program.version,
      description: program.description,
    }));
  }

  /**
   * Проверить валидность программы
   */
  validateProgram(program: ProgramConfig): boolean {
    if (!program.name || !program.steps || !program.settings) {
      return false;
    }

    // Проверяем, что есть хотя бы один шаг
    if (Object.keys(program.steps).length === 0) {
      return false;
    }

    return true;
  }
}
