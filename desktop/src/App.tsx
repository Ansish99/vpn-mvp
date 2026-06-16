import { useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { Dashboard } from "./Dashboard";
import "./App.css";

const TOKEN_KEY = "securetunnel.token";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  function handleAuthenticated(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return token ? (
    <Dashboard token={token} onLogout={handleLogout} />
  ) : (
    <AuthScreen onAuthenticated={handleAuthenticated} />
  );
}
