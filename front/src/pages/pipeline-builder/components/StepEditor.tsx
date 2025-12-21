import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { PipelineConfig, PipelineStep } from "@/types/pipeline";

interface StepEditorProps {
  stepId: string;
  step: PipelineStep;
  pipeline: PipelineConfig;
  onUpdate: (stepId: string, stepData: Partial<PipelineStep>) => void;
  onClose: () => void;
}

const StepEditor = ({
  stepId,
  step,
  pipeline,
  onUpdate,
  onClose,
}: StepEditorProps) => {
  const [localStep, setLocalStep] = useState<PipelineStep>(step);

  useEffect(() => {
    setLocalStep(step);
  }, [step]);

  const handleSave = () => {
    onUpdate(stepId, localStep);
  };

  const handleQuestionChange = (value: string) => {
    setLocalStep((prev) => ({ ...prev, question: value || null }));
  };

  const handleSystemPromptChange = (value: string) => {
    setLocalStep((prev) => ({ ...prev, systemPrompt: value }));
  };

  const handleNextStepChange = (value: string) => {
    setLocalStep((prev) => ({
      ...prev,
      nextStep: value || undefined,
    }));
  };

  const handleConditionTypeChange = (type: string) => {
    if (type === "none") {
      setLocalStep((prev) => {
        const { condition, ...rest } = prev;
        return rest;
      });
    } else {
      setLocalStep((prev) => ({
        ...prev,
        condition: {
          type: type as "length" | "exists" | "llm-routing",
          params: {},
        },
      }));
    }
  };

  const handleConditionParamChange = (key: string, value: any) => {
    setLocalStep((prev) => ({
      ...prev,
      condition: prev.condition
        ? {
            ...prev.condition,
            params: {
              ...prev.condition.params,
              [key]: value,
            },
          }
        : undefined,
    }));
  };

  const handleConditionErrorMessageChange = (value: string) => {
    setLocalStep((prev) => ({
      ...prev,
      condition: prev.condition
        ? {
            ...prev.condition,
            errorMessage: value || undefined,
          }
        : undefined,
    }));
  };

  const availableSteps = Object.keys(pipeline.steps).filter(
    (id) => id !== stepId
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Редактирование шага</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>ID шага</Label>
              <Input value={`#${stepId}`} disabled className="mt-1" />
            </div>

            <div>
              <Label htmlFor="question">Вопрос</Label>
              <Textarea
                id="question"
                value={localStep.question || ""}
                onChange={(e) => handleQuestionChange(e.target.value)}
                placeholder="Введите вопрос для пользователя (или оставьте пустым)"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={localStep.systemPrompt || ""}
                onChange={(e) => handleSystemPromptChange(e.target.value)}
                placeholder="Введите системный промпт для LLM"
                className="mt-1 min-h-[150px]"
              />
            </div>

            <div>
              <Label htmlFor="nextStep">Следующий шаг</Label>
              <select
                id="nextStep"
                value={localStep.nextStep || ""}
                onChange={(e) => handleNextStepChange(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Нет следующего шага (конец)</option>
                {availableSteps.map((stepId) => (
                  <option key={stepId} value={stepId}>
                    #{stepId}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Условие</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="conditionType">Тип условия</Label>
              <select
                id="conditionType"
                value={localStep.condition?.type || "none"}
                onChange={(e) => handleConditionTypeChange(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="none">Без условия</option>
                <option value="length">Длина текста</option>
                <option value="exists">Проверка существования переменной</option>
                <option value="llm-routing">LLM роутинг</option>
              </select>
            </div>

            {localStep.condition?.type === "length" && (
              <>
                <div>
                  <Label htmlFor="minLength">Минимальная длина</Label>
                  <Input
                    id="minLength"
                    type="number"
                    value={localStep.condition.params.minLength || ""}
                    onChange={(e) =>
                      handleConditionParamChange(
                        "minLength",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="maxLength">Максимальная длина</Label>
                  <Input
                    id="maxLength"
                    type="number"
                    value={localStep.condition.params.maxLength || ""}
                    onChange={(e) =>
                      handleConditionParamChange(
                        "maxLength",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="errorMessage">Сообщение об ошибке</Label>
                  <Textarea
                    id="errorMessage"
                    value={localStep.condition.errorMessage || ""}
                    onChange={(e) =>
                      handleConditionErrorMessageChange(e.target.value)
                    }
                    className="mt-1"
                    placeholder="Сообщение, которое увидит пользователь при невыполнении условия"
                  />
                </div>
              </>
            )}

            {localStep.condition?.type === "exists" && (
              <>
                <div>
                  <Label htmlFor="variable">Имя переменной</Label>
                  <Input
                    id="variable"
                    value={localStep.condition.params.variable || ""}
                    onChange={(e) =>
                      handleConditionParamChange("variable", e.target.value)
                    }
                    className="mt-1"
                    placeholder="например: emotion"
                  />
                </div>
              </>
            )}

            {localStep.condition?.type === "llm-routing" && (
              <>
                <div>
                  <Label htmlFor="routingCondition">Условие роутинга</Label>
                  <Textarea
                    id="routingCondition"
                    value={localStep.condition.params.routingCondition || ""}
                    onChange={(e) =>
                      handleConditionParamChange(
                        "routingCondition",
                        e.target.value
                      )
                    }
                    className="mt-1 min-h-[100px]"
                    placeholder="Опишите условие роутинга..."
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full">
          Сохранить изменения
        </Button>
      </div>
    </div>
  );
};

export default StepEditor;

