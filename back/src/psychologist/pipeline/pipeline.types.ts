export enum PipelineStep {
  PROBLEM = 'problem',
  EMOTION = 'emotion',
  THOUGHT = 'thought',
  WHY = 'why',
  IDEAS = 'ideas',
  FOUNDER = 'founder',
  PURPOSE = 'purpose',
  CONSEQUENCES = 'consequences',
  CONCLUSION = 'conclusion',
}

export interface PipelineState {
  sessionId: string;
  programName?: string; // Название программы психолога
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
  message?: string;
}

