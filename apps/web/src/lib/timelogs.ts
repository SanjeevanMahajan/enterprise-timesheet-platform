import { apiClient } from "./api-client";
import type { StartTimerRequest, TimeLogResponse } from "./types";

export async function listTimeLogs(params?: {
  approval_status?: string;
}): Promise<TimeLogResponse[]> {
  const qs = params?.approval_status
    ? `?approval_status=${params.approval_status}`
    : "";
  return apiClient.get<TimeLogResponse[]>(`/timelogs${qs}`);
}

export async function startTimer(
  data: StartTimerRequest
): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>("/timelogs/timer/start", data);
}

export async function pauseTimer(
  timeLogId: string
): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>(
    `/timelogs/${timeLogId}/timer/pause`,
    {}
  );
}

export async function resumeTimer(
  timeLogId: string
): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>(
    `/timelogs/${timeLogId}/timer/resume`,
    {}
  );
}

export async function stopTimer(timeLogId: string): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>(
    `/timelogs/${timeLogId}/timer/stop`,
    {}
  );
}

export async function managerApprove(
  timeLogId: string
): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>(
    `/timelogs/${timeLogId}/manager-approve`,
    {}
  );
}

export async function managerReject(
  timeLogId: string,
  reason: string = ""
): Promise<TimeLogResponse> {
  return apiClient.post<TimeLogResponse>(
    `/timelogs/${timeLogId}/manager-reject`,
    { reason }
  );
}
