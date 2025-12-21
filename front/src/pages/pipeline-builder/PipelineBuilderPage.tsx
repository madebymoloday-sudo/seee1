import {
  createPipeline,
  deletePipeline,
  getAllPipelines,
  getPipeline,
  updatePipeline,
  type PipelineProgram,
} from "@/api/pipeline.api";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import type { PipelineConfig } from "@/types/pipeline";
import {
  Download,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Workflow,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";
import StepEditor from "./components/StepEditor";
import StepNode from "./components/StepNode";
import defaultPipelineData from "./defaultPipeline.json";

const nodeTypes: NodeTypes = {
  step: StepNode,
};

const initialPipeline: PipelineConfig = defaultPipelineData as PipelineConfig;

// Константы для раскладки
const HORIZONTAL_SPACING = 400; // Горизонтальное расстояние между узлами (увеличено для избежания перекрытий)
const VERTICAL_SPACING = 300; // Вертикальное расстояние между уровнями (увеличено)
const START_X = 150; // Начальная позиция X
const START_Y = 150; // Начальная позиция Y

// Функция автоматической раскладки узлов на основе графа
const calculateLayout = (
  stepNames: string[],
  steps: Record<string, PipelineConfig["steps"][string]>
): Record<string, { x: number; y: number }> => {
  const positions: Record<string, { x: number; y: number }> = {};

  // Строим граф зависимостей (какие шаги ведут к каким)
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  stepNames.forEach((stepId) => {
    graph[stepId] = [];
    inDegree[stepId] = 0;
  });

  stepNames.forEach((stepId: string) => {
    const step = steps[stepId];
    // Учитываем обычные переходы
    if (step?.nextStep && stepNames.includes(step.nextStep)) {
      graph[stepId].push(step.nextStep);
      inDegree[step.nextStep]++;
    }
    // Учитываем условные переходы через llm-routing
    if (
      step?.condition?.type === "llm-routing" &&
      step.condition.params?.routingCondition
    ) {
      const routingCondition = step.condition.params.routingCondition;
      // Извлекаем шаги из условия (упрощенный вариант)
      const routingMatches = routingCondition.matchAll(/перейди на\s+(\w+)/gi);
      for (const match of routingMatches) {
        const targetStep = match[1].trim();
        if (stepNames.includes(targetStep) && targetStep !== step.nextStep) {
          if (!graph[stepId].includes(targetStep)) {
            graph[stepId].push(targetStep);
            inDegree[targetStep]++;
          }
        }
      }
    }
  });

  // Топологическая сортировка для определения уровней
  const levels: string[][] = [];
  const queue: string[] = stepNames.filter((id: string) => inDegree[id] === 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentLevel: string[] = [];
    const levelSize = queue.length;

    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;

      visited.add(node);
      currentLevel.push(node);

      // Добавляем следующие узлы в очередь
      graph[node].forEach((nextNode: string) => {
        inDegree[nextNode]--;
        if (inDegree[nextNode] === 0 && !visited.has(nextNode)) {
          queue.push(nextNode);
        }
      });
    }

    if (currentLevel.length > 0) {
      levels.push(currentLevel);
    }
  }

  // Обрабатываем оставшиеся узлы (циклы или изолированные)
  stepNames.forEach((stepId: string) => {
    if (!visited.has(stepId)) {
      levels.push([stepId]);
    }
  });

  // Располагаем узлы по уровням с увеличенными отступами, чтобы избежать перекрытий
  levels.forEach((level, levelIndex) => {
    const y = START_Y + levelIndex * VERTICAL_SPACING;

    // Распределяем узлы равномерно с увеличенными отступами
    level.forEach((stepId, index) => {
      positions[stepId] = {
        x: START_X + index * HORIZONTAL_SPACING,
        y: y,
      };
    });
  });

  return positions;
};

const PipelineBuilderPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const isAdmin = (auth.user as { role?: string } | null)?.role === "admin";
  const [pipeline, setPipeline] = useState<PipelineConfig>(initialPipeline);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [savedPipelines, setSavedPipelines] = useState<PipelineProgram[]>([]);
  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(
    id || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const isUpdatingFromPipeline = useRef(false);
  const lastPipelineNodePositions = useRef<
    Record<string, { x: number; y: number }> | undefined
  >(undefined);

  // Преобразуем steps в узлы для React Flow
  const getInitialNodes = useCallback(
    (pipelineData: PipelineConfig): Node[] => {
      // Получаем все шаги из объекта steps
      const allStepNames = Object.keys(pipelineData.steps);

      // Используем stepOrder для определения порядка, но добавляем шаги, которых нет в stepOrder
      const orderedSteps = pipelineData.stepOrder || [];
      const unorderedSteps = allStepNames.filter(
        (stepId) => !orderedSteps.includes(stepId)
      );

      // Сначала идут шаги в порядке stepOrder, затем остальные
      const stepNames = [...orderedSteps, ...unorderedSteps];

      // Используем сохраненные позиции или вычисляем новую раскладку
      let positions = pipelineData.nodePositions || {};

      // Если нет сохраненных позиций для всех узлов, вычисляем автоматическую раскладку
      const hasAllPositions = stepNames.every(
        (stepId: string) => positions[stepId]
      );
      if (!hasAllPositions) {
        const autoLayout = calculateLayout(stepNames, pipelineData.steps);
        // Объединяем сохраненные позиции с автоматическими (приоритет сохраненным)
        positions = { ...autoLayout, ...positions };
      }

      return stepNames.map((stepId: string) => {
        const step = pipelineData.steps[stepId];
        const position = positions[stepId] || { x: START_X, y: START_Y };

        return {
          id: stepId,
          type: "step",
          position,
          data: {
            label: stepId,
            question: step?.question || "",
            isEnd: !step?.nextStep,
          },
        };
      });
    },
    []
  );

  // Функция для извлечения шагов и их условий из routingCondition
  const extractRoutingInfo = useCallback(
    (
      routingCondition: string,
      availableSteps: string[]
    ): Array<{ step: string; condition: string }> => {
      const routingInfo: Array<{ step: string; condition: string }> = [];

      // Улучшенный парсинг: ищем все вхождения "перейди на" и извлекаем контекст до него
      // Паттерн 1: "если X, перейди на Y" - извлекаем полное условие
      const ifPattern =
        /(?:если|когда)\s+((?:[^,)]+|\([^)]+\))+?)\s*,?\s*перейди на\s+(\w+)/gi;
      let match;
      while ((match = ifPattern.exec(routingCondition)) !== null) {
        const condition = match[1].trim();
        const stepName = match[2].trim();

        if (
          availableSteps.includes(stepName) &&
          !routingInfo.some((info) => info.step === stepName)
        ) {
          routingInfo.push({
            step: stepName,
            condition: `если ${condition}`,
          });
        }
      }

      // Паттерн 2: "в любом другом случае перейди на Y" или "иначе перейди на Y"
      const elsePattern =
        /(?:в\s+любом\s+другом\s+случае|иначе|в\s+противном\s+случае)[^,]*перейди на\s+(\w+)/gi;
      while ((match = elsePattern.exec(routingCondition)) !== null) {
        const stepName = match[1].trim();

        if (
          availableSteps.includes(stepName) &&
          !routingInfo.some((info) => info.step === stepName)
        ) {
          routingInfo.push({
            step: stepName,
            condition: "иначе",
          });
        }
      }

      return routingInfo;
    },
    []
  );

  const getInitialEdges = useCallback(
    (pipelineData: PipelineConfig): Edge[] => {
      const edges: Edge[] = [];
      const availableSteps = Object.keys(pipelineData.steps);

      Object.entries(pipelineData.steps).forEach(
        ([stepId, step]: [string, PipelineConfig["steps"][string]]) => {
          // Обычный переход через nextStep (будет обновлен, если есть llm-routing)
          if (step.nextStep && pipelineData.steps[step.nextStep]) {
            const isConditional = step.condition?.type === "llm-routing";
            edges.push({
              id: `${stepId}-${step.nextStep}`,
              source: stepId,
              target: step.nextStep,
              type: "smoothstep",
              animated: !isConditional,
              label: isConditional ? "иначе" : "",
              style: {
                stroke: isConditional ? "#10b981" : "#3b82f6",
                strokeWidth: isConditional ? 2.5 : 2,
              },
              labelStyle: isConditional
                ? {
                    fill: "#10b981",
                    fontWeight: 600,
                    fontSize: 11,
                  }
                : undefined,
              labelBgStyle: isConditional
                ? {
                    fill: "#fff",
                    fillOpacity: 0.95,
                    stroke: "#10b981",
                    strokeWidth: 1,
                    padding: "4px 6px",
                    rx: 4,
                  }
                : undefined,
            });
          }

          // Условные переходы через llm-routing
          if (
            step.condition?.type === "llm-routing" &&
            step.condition.params?.routingCondition
          ) {
            const routingCondition = step.condition.params.routingCondition;
            const routingInfo = extractRoutingInfo(
              routingCondition,
              availableSteps
            );

            routingInfo.forEach(
              ({ step: targetStep, condition: conditionText }) => {
                // Пропускаем, если это уже обычный nextStep (не дублируем)
                if (
                  targetStep !== step.nextStep &&
                  pipelineData.steps[targetStep]
                ) {
                  // Сокращаем текст условия для метки (максимум 40 символов для лучшей читаемости)
                  const shortLabel =
                    conditionText.length > 40
                      ? conditionText.substring(0, 37) + "..."
                      : conditionText;

                  edges.push({
                    id: `${stepId}-${targetStep}-routing`,
                    source: stepId,
                    target: targetStep,
                    type: "smoothstep",
                    animated: false,
                    label: shortLabel || "if",
                    style: {
                      stroke: "#ef4444",
                      strokeWidth: 2.5,
                      strokeDasharray: "8,4",
                    },
                    labelStyle: {
                      fill: "#ef4444",
                      fontWeight: 600,
                      fontSize: 10,
                    },
                    labelBgStyle: {
                      fill: "#fff",
                      fillOpacity: 0.98,
                      stroke: "#ef4444",
                      strokeWidth: 1.5,
                      padding: "3px 5px",
                      rx: 4,
                    },
                    labelShowBg: true,
                  });
                }
              }
            );
          }
        }
      );

      return edges;
    },
    [extractRoutingInfo]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    getInitialNodes(pipeline)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    getInitialEdges(pipeline)
  );

  // Сохраняем позиции узлов в конфиг при их изменении (только при пользовательском перетаскивании)
  useEffect(() => {
    if (!nodes.length || isUpdatingFromPipeline.current) return;

    const newPositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      newPositions[node.id] = { x: node.position.x, y: node.position.y };
    });

    // Обновляем позиции в конфиге только если они отличаются от текущих
    const currentPositions = pipeline.nodePositions || {};
    const positionsChanged =
      Object.keys(newPositions).length !==
        Object.keys(currentPositions).length ||
      Object.entries(newPositions).some(
        ([id, pos]) =>
          !currentPositions[id] ||
          Math.abs(currentPositions[id].x - pos.x) > 0.1 ||
          Math.abs(currentPositions[id].y - pos.y) > 0.1
      );

    if (positionsChanged) {
      // Обновляем ref, чтобы эффект обновления позиций знал, что это изменение от пользователя
      lastPipelineNodePositions.current = newPositions;
      setPipeline((prev: PipelineConfig) => ({
        ...prev,
        nodePositions: newPositions,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Обновляем позиции нод при изменении nodePositions (только если это изменение извне, не от пользователя)
  useEffect(() => {
    if (!pipeline.nodePositions || isUpdatingFromPipeline.current) return;

    // Проверяем, изменились ли позиции в pipeline по сравнению с последними сохраненными
    // Если позиции были только что сохранены пользователем (в lastPipelineNodePositions),
    // то не обновляем ноды, чтобы избежать цикла
    const currentPositions = pipeline.nodePositions;
    const lastSaved = lastPipelineNodePositions.current;

    // Если позиции совпадают с последними сохраненными пользователем, пропускаем обновление
    if (
      lastSaved &&
      Object.keys(currentPositions).length === Object.keys(lastSaved).length &&
      Object.keys(currentPositions).every(
        (id) =>
          lastSaved[id] &&
          Math.abs(currentPositions[id].x - lastSaved[id].x) < 0.1 &&
          Math.abs(currentPositions[id].y - lastSaved[id].y) < 0.1
      )
    ) {
      return;
    }

    setNodes((currentNodes) => {
      const positions = pipeline.nodePositions || {};
      const hasChanges = currentNodes.some(
        (node) =>
          !positions[node.id] ||
          Math.abs(positions[node.id].x - node.position.x) > 0.1 ||
          Math.abs(positions[node.id].y - node.position.y) > 0.1
      );

      if (hasChanges) {
        isUpdatingFromPipeline.current = true;
        const updatedNodes = currentNodes.map((node) => {
          const savedPosition = positions[node.id];
          if (savedPosition) {
            return { ...node, position: savedPosition };
          }
          return node;
        });

        // Сбрасываем флаг после обновления
        setTimeout(() => {
          isUpdatingFromPipeline.current = false;
        }, 0);

        return updatedNodes;
      }

      return currentNodes;
    });
  }, [pipeline.nodePositions, setNodes]);

  // Синхронизируем nodes и edges с pipeline (только при изменении структуры шагов)
  useEffect(() => {
    isUpdatingFromPipeline.current = true;

    setNodes((currentNodes) => {
      const currentStepIds = new Set(currentNodes.map((n) => n.id));
      // Используем все шаги из steps, а не только из stepOrder
      const allStepNames = Object.keys(pipeline.steps);
      const newStepIds = new Set<string>(allStepNames);

      // Проверяем, изменилась ли структура (добавлены/удалены шаги)
      const structureChanged =
        currentStepIds.size !== newStepIds.size ||
        allStepNames.some((id: string) => !currentStepIds.has(id)) ||
        Array.from(currentStepIds).some((id: string) => !newStepIds.has(id));

      if (structureChanged) {
        const newNodes = getInitialNodes(pipeline);
        // Сохраняем позиции существующих узлов
        const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));

        return newNodes.map((newNode) => {
          const existing = nodeMap.get(newNode.id);
          if (existing) {
            return { ...newNode, position: existing.position };
          }
          return newNode;
        });
      }

      return currentNodes;
    });

    // Сбрасываем флаг после обновления
    setTimeout(() => {
      isUpdatingFromPipeline.current = false;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.stepOrder, pipeline.steps, getInitialNodes, setNodes]);

  useEffect(() => {
    setEdges(getInitialEdges(pipeline));
  }, [pipeline, getInitialEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = addEdge(params, edges);
      setEdges(newEdge);

      // Обновляем nextStep в конфиге
      if (params.source && params.target) {
        setPipeline((prev: PipelineConfig) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [params.source!]: {
              ...prev.steps[params.source!],
              nextStep: params.target!,
            },
          },
        }));
      }
    },
    [edges, setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedStepId(node.id);
  }, []);

  const handleStepUpdate = useCallback(
    (stepId: string, stepData: Partial<PipelineConfig["steps"][string]>) => {
      setPipeline((prev: PipelineConfig) => ({
        ...prev,
        steps: {
          ...prev.steps,
          [stepId]: {
            ...prev.steps[stepId],
            ...stepData,
          },
        },
      }));
    },
    []
  );

  const handleAddStep = useCallback(() => {
    const newStepId = `step_${Date.now()}`;
    const newStep: PipelineConfig["steps"][string] = {
      question: "Новый вопрос?",
      systemPrompt: "",
    };

    setPipeline((prev: PipelineConfig) => {
      const stepNames = prev.stepOrder || Object.keys(prev.steps);
      // Вычисляем позицию для нового узла (справа от последнего)
      const newPositions = { ...(prev.nodePositions || {}) };
      if (stepNames.length > 0) {
        const lastStepId = stepNames[stepNames.length - 1];
        const lastPosition = newPositions[lastStepId] || {
          x: START_X,
          y: START_Y,
        };
        newPositions[newStepId] = {
          x: lastPosition.x + HORIZONTAL_SPACING,
          y: lastPosition.y,
        };
      } else {
        newPositions[newStepId] = { x: START_X, y: START_Y };
      }

      return {
        ...prev,
        stepOrder: [...prev.stepOrder, newStepId],
        steps: {
          ...prev.steps,
          [newStepId]: newStep,
        },
        nodePositions: newPositions,
      };
    });
  }, []);

  // Загрузка сохраненных пайплайнов
  const loadSavedPipelines = useCallback(async () => {
    setIsLoadingPipelines(true);
    try {
      const pipelines = await getAllPipelines();
      setSavedPipelines(pipelines);
    } catch (error) {
      console.error("Ошибка загрузки пайплайнов:", error);
    } finally {
      setIsLoadingPipelines(false);
    }
  }, []);

  // Загрузка пайплайна с сервера
  const handleLoadPipeline = useCallback(
    async (pipelineId: string, updateUrl: boolean = true) => {
      try {
        setIsLoadingPipeline(true);
        const loaded = await getPipeline(pipelineId);
        const loadedConfig = loaded.configJson;

        // Сбрасываем ref, чтобы эффект обновления позиций знал, что это загрузка с сервера
        lastPipelineNodePositions.current = undefined;

        // Устанавливаем пайплайн
        setPipeline(loadedConfig);
        setCurrentPipelineId(pipelineId);
        setSelectedStepId(null);

        // Обновляем URL, если нужно
        if (updateUrl) {
          navigate(`/pipeline-builder/${pipelineId}`, { replace: true });
        }

        // Принудительно обновляем ноды с позициями из загруженного пайплайна
        isUpdatingFromPipeline.current = true;
        const newNodes = getInitialNodes(loadedConfig);
        setNodes(newNodes);

        // Сбрасываем флаг после обновления
        setTimeout(() => {
          isUpdatingFromPipeline.current = false;
        }, 0);
      } catch (error) {
        console.error("Ошибка загрузки пайплайна:", error);
        toast.error("Не удалось загрузить пайплайн");
        navigate("/pipeline-builder", { replace: true });
      } finally {
        setIsLoadingPipeline(false);
      }
    },
    [getInitialNodes, setNodes, navigate]
  );

  // Сохранение пайплайна на сервер
  const handleSavePipeline = useCallback(async () => {
    if (!pipeline.name) {
      toast.error("Укажите название пайплайна в метаданных");
      return;
    }

    setIsSaving(true);
    try {
      if (currentPipelineId) {
        // Всегда обновляем существующий пайплайн, если есть ID
        await updatePipeline(currentPipelineId, {
          name: pipeline.name,
          version: pipeline.version,
          description: pipeline.description,
          configJson: pipeline,
        });
        toast.success("Пайплайн успешно обновлен");
      } else {
        // Создание нового пайплайна только если нет текущего ID
        const saved = await createPipeline({
          name: pipeline.name,
          version: pipeline.version,
          description: pipeline.description,
          configJson: pipeline,
        });
        setCurrentPipelineId(saved.id);
        navigate(`/pipeline-builder/${saved.id}`, { replace: true });
        toast.success("Пайплайн успешно сохранен");
      }
      await loadSavedPipelines();
    } catch (error: unknown) {
      console.error("Ошибка сохранения пайплайна:", error);
      const errorMessage =
        (
          error as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (error as { message?: string })?.message ||
        "Не удалось сохранить пайплайн";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [pipeline, currentPipelineId, loadSavedPipelines, navigate]);

  // Удаление пайплайна
  const handleDeletePipeline = useCallback(
    async (pipelineId: string) => {
      if (!confirm("Вы уверены, что хотите удалить этот пайплайн?")) {
        return;
      }

      try {
        await deletePipeline(pipelineId);
        if (currentPipelineId === pipelineId) {
          setCurrentPipelineId(null);
          setPipeline(initialPipeline);
          navigate("/pipeline-builder", { replace: true });
        }
        await loadSavedPipelines();
        toast.success("Пайплайн успешно удален");
      } catch (error) {
        console.error("Ошибка удаления пайплайна:", error);
        toast.error("Не удалось удалить пайплайн");
      }
    },
    [currentPipelineId, loadSavedPipelines, navigate]
  );

  // Загрузка пайплайнов при монтировании
  useEffect(() => {
    loadSavedPipelines();
  }, [loadSavedPipelines]);

  // Загрузка пайплайна из URL при монтировании или изменении id
  useEffect(() => {
    if (id && id !== currentPipelineId) {
      handleLoadPipeline(id, false);
    } else if (!id && currentPipelineId) {
      // Если id убран из URL, но есть текущий пайплайн - сбрасываем
      setCurrentPipelineId(null);
      setPipeline(initialPipeline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Автоматически выбираем первый пайплайн, если нет выбранного и нет ID в URL
  useEffect(() => {
    if (
      !id &&
      !currentPipelineId &&
      savedPipelines.length > 0 &&
      !isLoadingPipelines
    ) {
      const firstPipeline = savedPipelines[0];
      handleLoadPipeline(firstPipeline.id, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPipelines, id, currentPipelineId, isLoadingPipelines]);

  const handleExportJSON = useCallback(() => {
    const jsonString = JSON.stringify(pipeline, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pipeline.name || "pipeline"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pipeline]);

  const handleImportJSON = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported: PipelineConfig = JSON.parse(
            e.target?.result as string
          );
          setPipeline(imported);
          // Сбрасываем input, чтобы можно было загрузить тот же файл снова
          event.target.value = "";
        } catch (error) {
          console.error("Ошибка при загрузке JSON:", error);
          toast.error("Ошибка при загрузке файла. Проверьте формат JSON.");
          event.target.value = "";
        }
      };
      reader.readAsText(file);
    },
    []
  );

  const selectedStep = selectedStepId ? pipeline.steps[selectedStepId] : null;

  return (
    <Layout>
      <div className="h-screen flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Workflow className="h-6 w-6" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Конструктор пайплайна</h1>
            </div>
            <div className="flex items-center gap-2 min-w-[300px]">
              <Label htmlFor="pipeline-select" className="whitespace-nowrap">
                Пайплайн:
              </Label>
              <select
                id="pipeline-select"
                value={currentPipelineId || ""}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (selectedId) {
                    handleLoadPipeline(selectedId);
                  }
                }}
                disabled={isLoadingPipeline || isLoadingPipelines}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!currentPipelineId && (
                  <option value="">-- Выберите пайплайн --</option>
                )}
                {savedPipelines.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name}
                    {saved.isDefault ? " (по умолчанию)" : ""}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={loadSavedPipelines}
                disabled={isLoadingPipelines}
                title="Обновить список"
              >
                {isLoadingPipelines ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Download className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
              {isAdmin && currentPipelineId && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeletePipeline(currentPipelineId)}
                  title="Удалить текущий пайплайн"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </Button>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentPipelineId(null);
                  setPipeline(initialPipeline);
                  navigate("/pipeline-builder", { replace: true });
                }}
              >
                Создать новый
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                title={
                  isEditingMetadata
                    ? "Скрыть метаданные"
                    : "Редактировать метаданные"
                }
              >
                <Pencil className="h-4 w-4" strokeWidth={2} />
              </Button>
              <Button
                onClick={handleSavePipeline}
                disabled={isSaving}
                size="icon"
                title={currentPipelineId ? "Обновить" : "Сохранить на сервер"}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Импорт JSON
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
              <Button variant="outline" onClick={handleExportJSON}>
                <Download className="h-4 w-4 mr-2" />
                Экспорт JSON
              </Button>
            </div>
          )}
        </div>

        {isEditingMetadata && (
          <Card className="m-4">
            <CardHeader>
              <CardTitle>Метаданные пайплайна</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={pipeline.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPipeline((prev: PipelineConfig) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="version">Версия</Label>
                <Input
                  id="version"
                  value={pipeline.version}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPipeline((prev: PipelineConfig) => ({
                      ...prev,
                      version: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={pipeline.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPipeline((prev: PipelineConfig) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex-1 flex">
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
            {/* Кнопка добавления шага на графе */}
            {isAdmin && (
              <Button
                className="absolute top-4 right-4 z-10 shadow-lg"
                onClick={handleAddStep}
                size="lg"
                title="Добавить шаг"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить шаг
              </Button>
            )}
          </div>

          {selectedStepId && selectedStep && (
            <div className="w-96 border-l bg-white overflow-y-auto">
              <StepEditor
                stepId={selectedStepId}
                step={selectedStep}
                pipeline={pipeline}
                onUpdate={handleStepUpdate}
                onClose={() => setSelectedStepId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

export default PipelineBuilderPage;
