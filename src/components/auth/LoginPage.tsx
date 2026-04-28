// src/components/auth/LoginPage.tsx

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
  fontSize:     13,
  padding:      "8px 40px 8px 12px",
  outline:      "none",
  boxSizing:    "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
  width:        "100%",
  padding:      "10px 0",
  fontSize:     12,
  fontFamily:   "'Syne', sans-serif",
  fontWeight:   700,
  letterSpacing: 1,
  border:       "none",
  borderRadius: 4,
  background:   C.accent,
  color:        "#fff",
  cursor:       "pointer",
};

const EYE_BTN: React.CSSProperties = {
  position:   "absolute",
  right:      10,
  top:        "50%",
  transform:  "translateY(-50%)",
  background: "none",
  border:     "none",
  color:      C.label,
  cursor:     "pointer",
  fontSize:   11,
  fontFamily: "'Syne', sans-serif",
  fontWeight: 700,
  letterSpacing: 0.5,
  padding:    "2px 4px",
  lineHeight: 1,
};

const TEXT_BTN: React.CSSProperties = {
  background: "none",
  border:     "none",
  color:      C.accent,
  cursor:     "pointer",
  fontSize:   11,
  fontFamily: "'Syne', sans-serif",
  fontWeight: 700,
  padding:    0,
  textAlign:  "left",
};

export default function LoginPage() {
  const { login, register, loading, error } = useAuthStore();

  const [tab,       setTab]       = useState<"login" | "register" | "forgot">("login");
  const [username,  setUsername]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [localMsg,  setLocalMsg]  = useState<{ ok: boolean; text: string; debug_token?: string } | null>(null);

  const [showPw,  setShowPw]  = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const reset = () => {
    setUsername(""); setEmail(""); setPassword(""); setPassword2("");
    setLocalMsg(null); setShowPw(false); setShowPw2(false);
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLocalMsg(null);
    const ok = await login(username, password);
    if (!ok) setLocalMsg({ ok: false, text: useAuthStore.getState().error ?? "Login gagal" });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLocalMsg(null);
    if (username.length < 3) {
      setLocalMsg({ ok: false, text: "Username minimal 3 karakter." });
      return;
    }
    if (password.length < 8) {
      setLocalMsg({ ok: false, text: "Password minimal 8 karakter." });
      return;
    }
    if (password !== password2) {
      setLocalMsg({ ok: false, text: "Password tidak cocok." });
      return;
    }
    const res = await register(username, email, password);
    setLocalMsg({ ok: res.ok, text: res.message });
    if (res.ok) { reset(); setTab("login"); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLocalMsg(null);
    const { forgotPassword } = useAuthStore.getState();
    const res = await forgotPassword(email);
    setLocalMsg({ ok: res.ok, text: res.message, debug_token: res.debug_token });
  }

  const handleOpenReset = () => {
    if (localMsg?.debug_token) {
      window.location.href = `/reset-password?token=${localMsg.debug_token}`;
    }
  };

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
          <div style={{ fontSize: 11, color: C.label, marginTop: 4, fontFamily: "'Syne',sans-serif" }}>
            Virtual Trading · Pasar Saham Indonesia
          </div>
        </div>

        {/* Tabs */}
        {tab !== "forgot" && (
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
            {(["login", "register"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); reset(); }}
                style={{
                  flex: 1, padding: "8px 0", fontSize: 11,
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
        )}

        {/* ── Login form ── */}
        {tab === "login" && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Username">
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="username" autoComplete="username"
                style={{ ...INPUT, paddingRight: 12 }} required />
            </Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  style={INPUT} required />
                <button type="button" onClick={() => setShowPw(v => !v)} style={EYE_BTN}>
                  {showPw ? "SEMBUNYIKAN" : "LIHAT"}
                </button>
              </div>
            </Field>
            <div style={{ textAlign: "right", marginTop: -4 }}>
              <button type="button" onClick={() => { setTab("forgot"); reset(); }} style={TEXT_BTN}>
                Lupa Password?
              </button>
            </div>
            <button type="submit" disabled={loading}
              style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        )}

        {/* ── Register form ── */}
        {tab === "register" && (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Username">
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="min. 3 karakter (a-z, 0-9, _, -)" autoComplete="username"
                style={{ ...INPUT, paddingRight: 12 }} required 
                pattern="^[a-zA-Z0-9_-]+$" title="Hanya huruf, angka, underscore, atau dash" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nama@email.com" autoComplete="email"
                style={{ ...INPUT, paddingRight: 12 }} required />
            </Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="min. 8 karakter" autoComplete="new-password"
                  style={INPUT} required />
                <button type="button" onClick={() => setShowPw(v => !v)} style={EYE_BTN}>
                  {showPw ? "SEMBUNYIKAN" : "LIHAT"}
                </button>
              </div>
            </Field>
            <Field label="Konfirmasi password">
              <div style={{ position: "relative" }}>
                <input type={showPw2 ? "text" : "password"}
                  value={password2} onChange={e => setPassword2(e.target.value)}
                  placeholder="ulangi password" autoComplete="new-password"
                  style={{
                    ...INPUT,
                    borderColor: password2 && password !== password2 ? C.dn : C.border,
                  }} required />
                <button type="button" onClick={() => setShowPw2(v => !v)} style={EYE_BTN}>
                  {showPw2 ? "SEMBUNYIKAN" : "LIHAT"}
                </button>
              </div>
              {password2 && password !== password2 && (
                <div style={{ fontSize: 11, color: C.dn, marginTop: 4 }}>
                  Password tidak cocok
                </div>
              )}
            </Field>
            <button type="submit" disabled={loading || (!!password2 && password !== password2)}
              style={{ ...BTN_PRIMARY, background: C.up, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Memproses..." : "Daftar"}
            </button>
          </form>
        )}

        {/* ── Forgot Password form ── */}
        {tab === "forgot" && (
          <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: C.text, marginBottom: 8, textAlign: "center", fontFamily: "'Syne', sans-serif" }}>
              Lupa Password
            </div>
            <div style={{ fontSize: 11, color: C.label, marginBottom: 12, textAlign: "center" }}>
              Masukkan email Anda untuk menerima instruksi reset password.
            </div>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nama@email.com" autoComplete="email"
                style={{ ...INPUT, paddingRight: 12 }} required />
            </Field>
            <button type="submit" style={{ ...BTN_PRIMARY, marginTop: 8 }}>
              Kirim Instruksi
            </button>
            <button type="button" onClick={() => { setTab("login"); reset(); }} 
              style={{ ...TEXT_BTN, textAlign: "center", marginTop: 8 }}>
              Kembali ke Login
            </button>
          </form>
        )}

        {/* Feedback */}
        {(localMsg || error) && (
          <div style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 4, fontSize: 12,
            background: (localMsg?.ok) ? "rgba(0,214,143,0.1)" : "rgba(255,69,96,0.1)",
            color:      (localMsg?.ok) ? C.up : C.dn,
            border:     `1px solid ${(localMsg?.ok) ? "rgba(0,214,143,0.3)" : "rgba(255,69,96,0.3)"}`,
          }}>
            <div>{localMsg?.text || error}</div>
            
            {/* DEV Mode Debug Panel */}
            {localMsg?.debug_token && (
              <div style={{ 
                marginTop: 8, paddingTop: 8, borderTop: `1px solid rgba(0,214,143,0.2)`,
                fontSize: 10, color: C.text 
              }}>
                <div style={{ color: C.label, marginBottom: 4 }}>DEBUG TOKEN (Local Dev):</div>
                <div style={{ 
                  background: "#000", padding: 4, borderRadius: 2, 
                  fontFamily: "monospace", wordBreak: "break-all", marginBottom: 8
                }}>
                  {localMsg.debug_token}
                </div>
                <button type="button" onClick={handleOpenReset}
                  style={{
                    background: C.accent, color: "#fff", border: "none",
                    borderRadius: 2, padding: "4px 8px", fontSize: 10,
                    fontWeight: 700, cursor: "pointer", width: "100%"
                  }}>
                  BUKA RESET PASSWORD PAGE
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.label, fontFamily: "'Syne',sans-serif",
        letterSpacing: 1, marginBottom: 5 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}
