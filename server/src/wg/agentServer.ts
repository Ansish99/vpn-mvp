import { execFile } from "node:child_process";
import express from "express";
import { config } from "../config.js";

/**
 * wg-agent: a tiny privileged helper meant to run ON each actual WireGuard
 * box (the central API in index.ts never touches a wg interface directly).
 *
 * Deploy this next to a real `wg0` interface (see /docs/server-setup.md),
 * put it behind TLS (e.g. a Caddy/nginx reverse proxy or a private network),
 * and run it as a user allowed to run `wg` (typically root, via systemd).
 */

const WG_PUBLIC_KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/; // 32-byte base64 key
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIpv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split(".").every((octet) => Number(octet) <= 255);
}

function runWg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("wg", args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.headers["x-agent-secret"] !== config.agentSharedSecret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

app.post("/peers", async (req, res) => {
  const { publicKey, allowedIp } = req.body as { publicKey?: string; allowedIp?: string };

  if (!publicKey || !WG_PUBLIC_KEY_RE.test(publicKey)) {
    res.status(400).json({ error: "Invalid WireGuard public key" });
    return;
  }
  if (!allowedIp || !isValidIpv4(allowedIp)) {
    res.status(400).json({ error: "Invalid allowedIp" });
    return;
  }

  try {
    await runWg([
      "set",
      config.wgInterface,
      "peer",
      publicKey,
      "allowed-ips",
      `${allowedIp}/32`,
    ]);
    res.status(201).json({ status: "added" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete("/peers/:publicKey", async (req, res) => {
  const { publicKey } = req.params;
  if (!WG_PUBLIC_KEY_RE.test(publicKey)) {
    res.status(400).json({ error: "Invalid WireGuard public key" });
    return;
  }

  try {
    await runWg(["set", config.wgInterface, "peer", publicKey, "remove"]);
    res.status(200).json({ status: "removed" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(config.agentPort, () => {
  console.log(`wg-agent listening on http://localhost:${config.agentPort}`);
});
