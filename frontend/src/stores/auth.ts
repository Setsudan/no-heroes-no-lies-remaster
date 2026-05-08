import { computed, ref } from "vue";
import type { AuthResponse, User } from "../api/auth";
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister, enterAsGuest as apiEnterAsGuest } from "../api/auth";

const TOKEN_STORAGE_KEY = "nhnl.auth.token";
const currentUser = ref<User | null>(null);
const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY));
const isLoading = ref(false);
const error = ref<string | null>(null);
const authProbeDone = ref(false);

async function handleAuthSuccess(response: AuthResponse): Promise<void> {
  currentUser.value = response.user;
  token.value = response.token;
  localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
  error.value = null;
}

async function handleLogin(email: string, password: string): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await apiLogin({ email, password });
    await handleAuthSuccess(response);
  } catch (err) {
    const message = (err as Error).message || "Failed to login";
    error.value = message;
    throw err;
  } finally {
    isLoading.value = false;
  }
}

async function handleRegister(username: string, email: string, password: string): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await apiRegister({ username, email, password });
    await handleAuthSuccess(response);
  } catch (err) {
    const message = (err as Error).message || "Failed to register";
    error.value = message;
    throw err;
  } finally {
    isLoading.value = false;
  }
}

async function handleGuestLogin(username: string): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await apiEnterAsGuest(username);
    await handleAuthSuccess(response);
  } catch (err) {
    const message = (err as Error).message || "Failed to enter as guest";
    error.value = message;
    throw err;
  } finally {
    isLoading.value = false;
  }
}

async function handleFetchMe(): Promise<void> {
  isLoading.value = true;
  try {
    const user = await apiMe();
    currentUser.value = user;
    error.value = null;
  } catch (err) {
    currentUser.value = null;
    const message = (err as Error).message || "";
    if (!message.toLowerCase().includes("unauthorized")) {
      error.value = message || "Failed to fetch current user";
    }
  } finally {
    authProbeDone.value = true;
    isLoading.value = false;
  }
}

async function handleLogout(): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    await apiLogout();
  } catch {
    // ignore logout errors
  } finally {
    currentUser.value = null;
    token.value = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    isLoading.value = false;
    authProbeDone.value = true;
  }
}

export function useAuthStore() {
  const isAuthenticated = computed(() => currentUser.value !== null);

  return {
    currentUser,
    token,
    isLoading,
    error,
    authProbeDone,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    guestLogin: handleGuestLogin,
    fetchMe: handleFetchMe,
    logout: handleLogout
  };
}

