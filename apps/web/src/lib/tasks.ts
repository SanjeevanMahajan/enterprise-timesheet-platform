import { apiClient } from "./api-client";
import type { TaskResponse } from "./types";

export async function listTasks(projectId?: string): Promise<TaskResponse[]> {
  const params = projectId ? `?project_id=${projectId}` : "";
  return apiClient.get<TaskResponse[]>(`/tasks${params}`);
}
