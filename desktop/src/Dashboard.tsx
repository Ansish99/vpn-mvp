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

  const state = busy ? "busy" : connected ? "connected" : "disconnected";

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <span className="brand-name">SecureTunnel</span>
        </div>
        <button className="link" onClick={onLogout}>
          Log out
        </button>
      </header>

      <div className="orb-stage">
        <button
          className={`orb orb--${state}`}
          onClick={connected ? handleDisconnect : handleConnect}
          disabled={busy || !selectedServerId}
          aria-label={connected ? "Disconnect" : "Connect"}
        >
          <span className="orb-ring orb-ring--1" />
          <span className="orb-ring orb-ring--2" />
          <span className="orb-core">
            <svg className="orb-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path
                d="M6.4 6.9a8 8 0 1 0 11.2 0"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>

        <div className="status-line">
          <span className={`status-pill status-pill--${state}`}>
            <span className="status-dot" />
            {busy ? "Connecting…" : connected ? "Protected" : "Not connected"}
          </span>
        </div>
        <div className="status-sub">
          {connected ? (
            <>
              {connected.server.city}, {connected.server.country}
              <span className="status-timer">{elapsedLabel}</span>
            </>
          ) : (
            "Tap to secure your connection"
          )}
        </div>
      </div>

      <div className="controls">
        <label className="field-label" htmlFor="server-select">
          Server location
        </label>
        <div className="select-wrap">
          <svg className="select-pin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          </svg>
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
          <svg className="select-caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="ip-row">
          <span>Visible IP address</span>
          <strong>{publicIp ?? "—"}</strong>
        </div>
      </div>
    </div>
  );
}
