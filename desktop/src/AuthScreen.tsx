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
      <h1>SecureTunnel</h1>
      <p className="subtitle">{mode === "login" ? "Log in to connect" : "Create your account"}</p>
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
        <button type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log In" : "Sign Up"}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </div>
  );
}
