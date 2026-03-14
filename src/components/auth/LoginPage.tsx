// src/components/auth/LoginPage.tsx
//
// Halaman login / register — ditampilkan oleh App.tsx
// jika user belum login (token null atau expired).
//
// Design: Bloomberg-dark minimal, dua tab Login / Register.

import { useState } from "react";
import { useAuthStore } from "../../stores/useAuthStore";

const C = {
  bg:     "#040d1a",
  card:   "#070d1c",
  border: "#0f2040",
  muted:  "#2a4060",
  label:  "#4a6080",
  text:   "#c8d8f0",
  accent: "#2e8fdf",
  up:     "#00d68f",
  dn:     "#ff4560",
};

const INPUT: React.CSSProperties = {
  width:        "100%",
  background:   "#040d1a",
  border:       `1px solid ${C.border}`,
  borderRadius: 4,
  color:        C.text,
  fontFamily:   "'Space Mono', monospace",
  fontSize:     12,
  padding:      "8px 12px",
  outline:      "none",
  boxSizing:    "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
  width:        "100%",
  padding:      "9px 0",
  fontSize:     11,
  fontFamily:   "'Syne', sans-serif",
  fontWeight:   700,
  letterSpacing: 1,
  border:       "none",
  borderRadius: 4,
  background:   C.accent,
  color:        "#fff",
  cursor:       "pointer",
};

export default function LoginPage() {
  const { login, register, loading, error } = useAuthStore();

  const [tab,        setTab]        = useState<"login" | "register">("login");
  const [username,   setUsername]   = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [password2,  setPassword2]  = useState("");
  const [localMsg,   setLocalMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const reset = () => { setUsername(""); setEmail(""); setPassword(""); setPassword2(""); setLocalMsg(null); };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLocalMsg(null);
    const ok = await login(username, password);
    if (!ok) setLocalMsg({ ok: false, text: error ?? "Login gagal" });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLocalMsg(null);
    if (password !== password2) {
      setLocalMsg({ ok: false, text: "Password tidak cocok." });
      return;
    }
    const res = await register(username, email, password);
    setLocalMsg({ ok: res.ok, text: res.message });
    if (res.ok) { reset(); setTab("login"); }
  }

  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: C.bg,
    }}>
      <div style={{
        width: 340, background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "28px 28px",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: 2 }}>
            IDX<span style={{ color: C.accent }}>TERMINAL</span>
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
          {(["login", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); reset(); }}
              style={{
                flex: 1, padding: "7px 0", fontSize: 10,
                fontFamily: "'Syne',sans-serif", fontWeight: 700,
                letterSpacing: 1, border: "none",
                background: "transparent", cursor: "pointer",
                color: tab === t ? C.accent : C.muted,
                borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent",
              }}>
              {t === "login" ? "MASUK" : "DAFTAR"}
            </button>
          ))}
        </div>

        {/* ── Login form ── */}
        {tab === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Username">
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="username" autoComplete="username" style={INPUT} required />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" style={INPUT} required />
            </Field>
            <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        )}

        {/* ── Register form ── */}
        {tab === "register" && (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Username">
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="min. 3 karakter" autoComplete="username" style={INPUT} required />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nama@email.com" autoComplete="email" style={INPUT} required />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="min. 8 karakter" autoComplete="new-password" style={INPUT} required />
            </Field>
            <Field label="Konfirmasi password">
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
                placeholder="ulangi password" autoComplete="new-password" style={INPUT} required />
            </Field>
            <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, background: C.up, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Memproses..." : "Daftar"}
            </button>
          </form>
        )}

        {/* Feedback */}
        {localMsg && (
          <div style={{
            marginTop: 10, padding: "7px 12px", borderRadius: 4, fontSize: 11,
            background: localMsg.ok ? "rgba(0,214,143,0.1)" : "rgba(255,69,96,0.1)",
            color:      localMsg.ok ? C.up : C.dn,
            border:     `1px solid ${localMsg.ok ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
          }}>
            {localMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.label, fontFamily: "'Syne',sans-serif",
        letterSpacing: 1, marginBottom: 4 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}