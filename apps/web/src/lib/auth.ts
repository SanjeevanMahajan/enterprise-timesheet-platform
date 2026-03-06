import { apiClient } from "./api-client";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserProfile,
  UserResponse,
} from "./types";

export async function register(data: RegisterRequest): Promise<UserResponse> {
  const user = await apiClient.post<UserResponse>("/auth/register", data);
  saveUserProfile({ email: user.email, full_name: user.full_name, role: user.role });
  return user;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const tokens = await apiClient.post<TokenResponse>("/auth/login", data);
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  // Store at least the email we know from the login form
  const existing = getUserProfile();
  if (!existing || existing.email !== data.email) {
    saveUserProfile({ email: data.email, full_name: "", role: "member" });
  }
  return tokens;
}

export function logout(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_profile");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem("user_profile", JSON.stringify(profile));
}

export function getUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user_profile");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}
