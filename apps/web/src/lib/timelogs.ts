import { apiClient } from "./api-client";
import type { StartTimerRequest, TimeLogResponse } from "./types";

export async function listTimeLogs(): Promise<TimeLogResponse[]> {
  return apiClient.get<TimeLogResponse[]>("/timelogs");
}

export async function startTimer(
  data: StartTimerRequest
): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>("/timelogs/timer/start", data);
}

export async function stopTimer(timeLogId: string): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>(
    `/timelogs/${timeLogId}/timer/stop`,
    {}
  );
}
