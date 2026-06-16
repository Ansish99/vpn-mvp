const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export interface ServerLocation {
  id: string;
  name: string;
  city: string;
  country: string;
}

export interface ConnectResponse {
  server: {
    id: string;
    name: string;
    city: string;
    country: string;
    endpointHost: string;
    endpointPort: number;
    serverPublicKey: string;
  };
  assignedIp: string;
  subnetCidr: string;
  dns: string;
  connectedAt: string;
}

export interface StatusResponse {
  connected: boolean;
  server?: { id: string; name: string; city: string; country: string };
  assignedIp?: string;
  connectedAt?: string;
}

class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ token: string; email: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; email: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  servers: () => request<ServerLocation[]>("/api/servers"),

  connect: (token: string, serverId: string, clientPublicKey: string) =>
    request<ConnectResponse>(
      "/api/vpn/connect",
      { method: "POST", body: JSON.stringify({ serverId, clientPublicKey }) },
      token,
    ),

  disconnect: (token: string) =>
    request<{ status: string }>("/api/vpn/disconnect", { method: "POST" }, token),

  status: (token: string) => request<StatusResponse>("/api/vpn/status", {}, token),
};
