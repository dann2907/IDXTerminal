// src/stores/useAuthStore.ts
//
// Zustand store untuk auth state.
// Terintegrasi dengan Axios interceptor di src/lib/api.ts.

import { create } from "zustand";
import { authApi } from "../lib/api";

const TOKEN_KEY = "idx_access_token";

interface AuthUser {
  id:         string;
  username:   string;
  email:      string;
  created_at: string;
}

interface AuthState {
  token:       string | null;
  user:        AuthUser | null;
  initialized: boolean; // Flag apakah bootstrap loadMe sudah selesai
  loading:     boolean;
  error:       string | null;

  // Actions
  login:          (u: string, p: string) => Promise<boolean>;
  register:       (u: string, e: string, p: string) => Promise<{ ok: boolean; message: string }>;
  logout:         () => Promise<void>;
  changePassword: (oldP: string, newP: string) => Promise<{ ok: boolean; message: string }>;
  loadMe:         () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token:       localStorage.getItem(TOKEN_KEY),
  user:        null,
  initialized: false,
  loading:     false,
  error:       null,

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const body = new URLSearchParams({ username, password });
      const { data } = await authApi.login(body);
      
      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({ token: data.access_token });
      
      // Fetch user data
      await get().loadMe();
      return true;
    } catch (e: any) {
      set({ loading: false, error: e.message });
      return false;
    }
  },

  async register(username, email, password) {
    set({ loading: true, error: null });
    try {
      await authApi.register({ username, email, password });
      set({ loading: false });
      return { ok: true, message: "Registrasi berhasil. Silakan login." };
    } catch (e: any) {
      const msg = e.message;
      set({ loading: false, error: msg });
      return { ok: false, message: msg };
    }
  },

  async logout() {
    const token = get().token;
    if (token) {
      try {
        await authApi.logout();
      } catch (e) {
        console.warn("Backend logout failed (already revoked/expired):", e);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, initialized: true, loading: false, error: null });
  },

  async changePassword(old_password, new_password) {
    set({ loading: true, error: null });
    try {
      await authApi.changePw({ old_password, new_password });
      set({ loading: false });
      return { ok: true, message: "Password berhasil diubah." };
    } catch (e: any) {
      const msg = e.message;
      set({ loading: false, error: msg });
      return { ok: false, message: msg };
    }
  },

  async loadMe() {
    const token = get().token;
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const { data } = await authApi.me();
      set({ user: data, initialized: true, loading: false });
    } catch {
      // Interceptor will trigger logout() on 401, but we ensure here too
      get().logout();
    }
  },
}));
