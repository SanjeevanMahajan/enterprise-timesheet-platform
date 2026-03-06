import { apiClient } from "./api-client";
import type { CreateProjectRequest, ProjectResponse } from "./types";

export async function listProjects(): Promise<ProjectResponse[]> {
  return apiClient.get<ProjectResponse[]>("/projects");
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<ProjectResponse> {
  return apiClient.post<ProjectResponse>("/projects", data);
}
