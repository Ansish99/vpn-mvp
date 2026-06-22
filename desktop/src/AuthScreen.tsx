import { useState } from "react";
import { api } from "./api";

interface Props {
  onAuthenticated: (token: string) => void;
}

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = mode === "login" ? await api.login(email, password) : await api.register(email, password);
      onAuthenticated(result.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <img className="auth-mark" src="/favicon.svg" alt="" />
        <h1 className="auth-title">SecureTunnel</h1>
        <p className="subtitle">
          {mode === "login" ? "Welcome back — log in to connect" : "Create your account to get started"}
        </p>
      </div>

      <div className="segmented" role="tablist">
        <button
          type="button"
          className={`segmented-btn ${mode === "login" ? "active" : ""}`}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          className={`segmented-btn ${mode === "register" ? "active" : ""}`}
          onClick={() => setMode("register")}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
        </button>
      </form>

      <p className="auth-foot">
        <span className="lock-glyph" aria-hidden="true">🔒</span>
        End-to-end encrypted · Keys never leave your device
      </p>
    </div>
  );
}
