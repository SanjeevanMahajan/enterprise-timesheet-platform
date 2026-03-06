import { apiClient } from "./api-client";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserResponse,
} from "./types";

export async function register(data: RegisterRequest): Promise<UserResponse> {
  return apiClient.post<UserResponse>("/auth/register", data);
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const tokens = await apiClient.post<TokenResponse>("/auth/login", data);
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  return tokens;
}

export function logout(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
