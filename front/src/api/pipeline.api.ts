import { swrMutator, axiosInstance } from "./mutator";
import type { PipelineConfig } from "@/types/pipeline";

export interface PipelineProgram {
  id: string;
  userId: string;
  name: string;
  version?: string;
  description?: string;
  configJson: PipelineConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineDto {
  name: string;
  version?: string;
  description?: string;
  configJson: PipelineConfig;
  isDefault?: boolean;
}

export interface UpdatePipelineDto {
  name?: string;
  version?: string;
  description?: string;
  configJson?: PipelineConfig;
  isDefault?: boolean;
}

// SWR hooks
export const usePipelines = () => {
  return swrMutator<PipelineProgram[]>({
    url: `/api/v1/pipelines`,
    method: "GET",
  });
};

export const usePipeline = (id: string) => {
  return swrMutator<PipelineProgram>({
    url: `/api/v1/pipelines/${id}`,
    method: "GET",
  });
};

// Axios functions
export const createPipeline = async (
  data: CreatePipelineDto
): Promise<PipelineProgram> => {
  const response = await axiosInstance<PipelineProgram>({
    url: `/api/v1/pipelines`,
    method: "POST",
    data,
  });
  return response.data;
};

export const updatePipeline = async (
  id: string,
  data: UpdatePipelineDto
): Promise<PipelineProgram> => {
  const response = await axiosInstance<PipelineProgram>({
    url: `/api/v1/pipelines/${id}`,
    method: "PUT",
    data,
  });
  return response.data;
};

export const deletePipeline = async (id: string): Promise<void> => {
  await axiosInstance({
    url: `/api/v1/pipelines/${id}`,
    method: "DELETE",
  });
};

export const getAllPipelines = async (): Promise<PipelineProgram[]> => {
  const response = await axiosInstance<PipelineProgram[]>({
    url: `/api/v1/pipelines`,
    method: "GET",
  });
  return response.data;
};

export const getPipeline = async (id: string): Promise<PipelineProgram> => {
  const response = await axiosInstance<PipelineProgram>({
    url: `/api/v1/pipelines/${id}`,
    method: "GET",
  });
  return response.data;
};

