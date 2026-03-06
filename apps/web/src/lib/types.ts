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
  role: "admin" | "manager" | "member" | "viewer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
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

// -- User Profile (client-side) -----------------------------------------------

export interface UserProfile {
  email: string;
  full_name: string;
  role: string;
}
