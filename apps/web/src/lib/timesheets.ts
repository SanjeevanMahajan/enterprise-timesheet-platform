import { apiClient } from "./api-client";
import type { SubmitTimesheetRequest, TimesheetResponse } from "./types";

export async function submitTimesheet(
  data: SubmitTimesheetRequest
): Promise<TimesheetResponse> {
  return apiClient.post<TimesheetResponse>("/timesheets/submit", data);
}

export async function listMyTimesheets(): Promise<TimesheetResponse[]> {
  return apiClient.get<TimesheetResponse[]>("/timesheets/");
}

export async function listPendingTimesheets(): Promise<TimesheetResponse[]> {
  return apiClient.get<TimesheetResponse[]>("/timesheets/pending");
}

export async function approveTimesheet(
  timesheetId: string
): Promise<TimesheetResponse> {
  return apiClient.post<TimesheetResponse>(
    `/timesheets/${timesheetId}/approve`,
    {}
  );
}

export async function rejectTimesheet(
  timesheetId: string,
  reason: string = ""
): Promise<TimesheetResponse> {
  return apiClient.post<TimesheetResponse>(
    `/timesheets/${timesheetId}/reject`,
    { reason }
  );
}
