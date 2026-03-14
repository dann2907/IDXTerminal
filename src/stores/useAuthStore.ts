// src/stores/useAuthStore.ts
//
// Zustand store untuk auth state.
// Token disimpan di localStorage agar persistent antar session.
// Semua request ke backend yang perlu auth menggunakan helper authFetch().

import { create } from "zustand";

const TOKEN_KEY = "idx_access_token";
const API       = "http://127.0.0.1:8765";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuthUser {
  id:         string;
  username:   string;
  email:      string;
  created_at: string;
}

interface AuthState {
  token:   string | null;
  user:    AuthUser | null;
  loading: boolean;
  error:   string | null;

  // Actions
  login:    (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  logout:   () => void;
  loadMe:   () => Promise<void>;    // verifikasi token yang tersimpan saat startup
}

// ── Helpers ────────────────────────────────────────────────────────────────

export async function authFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const json = await res.json() as T;
  if (!res.ok) {
    const detail = (json as { detail?: string }).detail ?? "Request gagal";
    throw new Error(detail);
  }
  return json;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  token:   localStorage.getItem(TOKEN_KEY),
  user:    null,
  loading: false,
  error:   null,

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      // OAuth2PasswordRequestForm butuh application/x-www-form-urlencoded
      const body = new URLSearchParams({ username, password });
      const res  = await fetch(`${API}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    body.toString(),
      });
      const json = await res.json() as { access_token?: string; detail?: string };

      if (!res.ok || !json.access_token) {
        const msg = json.detail ?? "Login gagal";
        set({ loading: false, error: msg });
        return false;
      }

      localStorage.setItem(TOKEN_KEY, json.access_token);
      set({ token: json.access_token, loading: false, error: null });

      // Langsung fetch user info
      await get().loadMe();
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      set({ loading: false, error: msg });
      return false;
    }
  },

  async register(username, email, password) {
    set({ loading: true, error: null });
    try {
      await authFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      set({ loading: false });
      return { ok: true, message: "Registrasi berhasil. Silakan login." };
    } catch (e) {
      const msg = (e as Error).message;
      set({ loading: false, error: msg });
      return { ok: false, message: msg };
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, error: null });
  },

  async loadMe() {
    const token = get().token;
    if (!token) return;
    try {
      const user = await authFetch<AuthUser>("/auth/me");
      set({ user });
    } catch {
      // Token expired atau invalid — logout
      get().logout();
    }
  },
}));