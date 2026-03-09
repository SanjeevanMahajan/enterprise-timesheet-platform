// API request/response types matching the FastAPI backend DTOs

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "member" | "viewer" | "client";
  is_active: boolean;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: string;
  client_id: string | null;
}

export interface ApiError {
  detail: string;
}

// -- Projects -----------------------------------------------------------------

export interface ProjectResponse {
  id: string;
  tenant_id: string;
  name: string;
  owner_id: string;
  status: "active" | "on_hold" | "completed" | "archived";
  description: string;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  is_billable: boolean;
  default_hourly_rate: number | null;
  estimated_hours: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

// -- Tasks --------------------------------------------------------------------

export interface TaskResponse {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  phase_id: string | null;
  due_date: string | null;
  estimated_hours: number;
  created_at: string;
  updated_at: string;
}

// -- Time Logs ----------------------------------------------------------------

export interface TimeLogResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  project_id: string;
  task_id: string | null;
  hours: number;
  log_date: string;
  description: string;
  billable: boolean;
  hourly_rate: number | null;
  billable_amount: number;
  timer_started_at: string | null;
  timer_stopped_at: string | null;
  is_timer_running: boolean;
  timer_status: "idle" | "running" | "paused" | "completed";
  accumulated_seconds: number;
  is_timer_paused: boolean;
  approval_status: "draft" | "pending_manager" | "approved" | "rejected";
  timesheet_id: string | null;
  ai_category: string | null;
  ai_quality_score: number | null;
  ai_suggestion: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartTimerRequest {
  project_id: string;
  log_date: string;
  task_id?: string | null;
  description?: string;
  billable?: boolean;
  hourly_rate?: number | null;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  client_id?: string | null;
  is_billable?: boolean;
  default_hourly_rate?: number | null;
}

// -- Billing (from billing-service) -------------------------------------------

export interface BillingStats {
  total_invoiced: number;
  invoice_count: number;
  total_paid: number;
  paid_count: number;
  awaiting_review_count: number;
  awaiting_review_amount: number;
  ready_to_bill_count: number;
  ready_to_bill_amount: number;
}

export interface BillingInvoice {
  id: string;
  tenant_id: string;
  total: number;
  line_item_count: number;
  status: string;
  stripe_session_id: string | null;
  payment_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface BillingLineItem {
  id: string;
  time_log_id: string;
  tenant_id: string;
  user_id: string;
  project_id: string;
  hours: number;
  hourly_rate: number | null;
  total: number;
  description: string;
  log_date: string;
  category: string | null;
  quality_score: number | null;
  billable: number;
  status: string;
  invoice_id: string | null;
  created_at: string;
}

// -- Timesheets ---------------------------------------------------------------

export interface TimesheetResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  total_hours: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  approved_by: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitTimesheetRequest {
  week_start: string;
  week_end: string;
}

// -- User Profile (client-side) -----------------------------------------------

export interface UserProfile {
  email: string;
  full_name: string;
  role: string;
  client_id?: string | null;
}
