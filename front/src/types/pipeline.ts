export interface PipelineCondition {
  type: "length" | "exists" | "llm-routing";
  params: {
    minLength?: number;
    maxLength?: number;
    variable?: string;
    routingCondition?: string;
    [key: string]: any;
  };
  errorMessage?: string;
}

export interface PipelineStep {
  question?: string | null;
  systemPrompt?: string;
  condition?: PipelineCondition;
  nextStep?: string;
}

export interface PipelineConfig {
  name: string;
  version: string;
  description: string;
  stepOrder: string[];
  steps: Record<string, PipelineStep>;
  variables: Record<string, string>;
  settings: {
    temperature: number;
    maxTokens: number;
    model: string;
  };
  nodePositions?: Record<string, { x: number; y: number }>;
}

