import { getJson, postJson, postNoContent } from "./client";

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return postJson<AuthResponse, RegisterRequest>("/auth/register", payload);
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return postJson<AuthResponse, LoginRequest>("/auth/login", payload);
}

export function me(): Promise<User> {
  return getJson<User>("/auth/me");
}

export function logout(): Promise<void> {
  return postNoContent("/auth/logout");
}

export function enterAsGuest(username: string): Promise<AuthResponse> {
  return postJson<AuthResponse, { username: string }>("/auth/guest", { username });
}

