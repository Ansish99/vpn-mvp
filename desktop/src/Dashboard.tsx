import { useEffect, useState } from "react";
import { api, type ServerLocation } from "./api";

interface Props {
  token: string;
  onLogout: () => void;
}

interface ConnectedInfo {
  server: { name: string; city: string; country: string };
  connectedAt: Date;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function Dashboard({ token, onLogout }: Props) {
  const [servers, setServers] = useState<ServerLocation[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [connected, setConnected] = useState<ConnectedInfo | null>(null);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState("00:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.servers().then((list) => {
      setServers(list);
      if (list.length > 0) setSelectedServerId(list[0].id);
    });
    refreshPublicIp();
    // A fresh app launch never has a live local tunnel even if the backend
    // thinks a prior session is active, so make sure both sides agree.
    api.disconnect(token).catch(() => {});
  }, []);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setElapsedLabel(formatDuration(Date.now() - connected.connectedAt.getTime()));
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  function refreshPublicIp() {
    window.vpn.getPublicIp().then(setPublicIp).catch(() => setPublicIp(null));
  }

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const keyPair = await window.vpn.generateKeyPair();
      const resp = await api.connect(token, selectedServerId, keyPair.publicKey);
      try {
        await window.vpn.connect({
          privateKey: keyPair.privateKey,
          assignedIp: resp.assignedIp,
          dns: resp.dns,
          serverPublicKey: resp.server.serverPublicKey,
          endpointHost: resp.server.endpointHost,
          endpointPort: resp.server.endpointPort,
        });
      } catch (tunnelErr) {
        await api.disconnect(token).catch(() => {});
        throw tunnelErr;
      }
      setConnected({ server: resp.server, connectedAt: new Date(resp.connectedAt) });
      setElapsedLabel("00:00");
      setTimeout(refreshPublicIp, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError(null);
    try {
      await window.vpn.disconnect().catch(() => {});
      await api.disconnect(token);
      setConnected(null);
      setTimeout(refreshPublicIp, 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>SecureTunnel</h1>
        <button className="link" onClick={onLogout}>
          Log out
        </button>
      </div>

      <div className={`status-card ${connected ? "connected" : "disconnected"}`}>
        <div className="status-dot" />
        <div>
          <div className="status-label">{connected ? "Connected" : "Disconnected"}</div>
          {connected && (
            <div className="status-detail">
              {connected.server.city}, {connected.server.country} · {elapsedLabel}
            </div>
          )}
        </div>
      </div>

      <label className="field-label" htmlFor="server-select">
        Server location
      </label>
      <select
        id="server-select"
        value={selectedServerId}
        onChange={(e) => setSelectedServerId(e.target.value)}
        disabled={!!connected || busy}
      >
        {servers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {s.city}, {s.country}
          </option>
        ))}
      </select>

      <button
        className={`connect-button ${connected ? "disconnect" : ""}`}
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={busy || !selectedServerId}
      >
        {busy ? "Working…" : connected ? "Disconnect" : "Connect"}
      </button>

      {error && <div className="error">{error}</div>}

      <div className="ip-row">
        <span>Visible IP address</span>
        <strong>{publicIp ?? "—"}</strong>
      </div>
    </div>
  );
}
