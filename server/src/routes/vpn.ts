import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getServer, subnetPrefix } from "../servers.js";
import { addPeer, removePeer } from "../wg/agentClient.js";

export const vpnRouter = Router();
vpnRouter.use(requireAuth);

interface SessionRow {
  id: number;
  user_id: number;
  server_id: string;
  client_public_key: string;
  assigned_ip: string;
  connected_at: string;
  disconnected_at: string | null;
}

function getActiveSession(userId: number): SessionRow | undefined {
  return db
    .prepare(
      "SELECT * FROM sessions WHERE user_id = ? AND disconnected_at IS NULL ORDER BY id DESC LIMIT 1",
    )
    .get(userId) as SessionRow | undefined;
}

/** Picks the lowest free host address (.2-.254) in the server's /24 pool. */
function allocateIp(serverId: string): string {
  const server = getServer(serverId)!;
  const prefix = subnetPrefix(server);

  const used = new Set(
    (
      db
        .prepare(
          "SELECT assigned_ip FROM sessions WHERE server_id = ? AND disconnected_at IS NULL",
        )
        .all(serverId) as { assigned_ip: string }[]
    ).map((r) => r.assigned_ip),
  );

  for (let host = 2; host <= 254; host++) {
    const candidate = `${prefix}.${host}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`No free addresses left in pool for server ${serverId}`);
}

async function endSession(session: SessionRow) {
  const server = getServer(session.server_id);
  if (server) {
    await removePeer(server, session.client_public_key);
  }
  db.prepare("UPDATE sessions SET disconnected_at = datetime('now') WHERE id = ?").run(
    session.id,
  );
}

const connectSchema = z.object({
  serverId: z.string().min(1),
  clientPublicKey: z.string().min(1),
});

vpnRouter.post("/connect", async (req: AuthedRequest, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { serverId, clientPublicKey } = parsed.data;
  const userId = req.userId!;

  const server = getServer(serverId);
  if (!server) {
    res.status(404).json({ error: "Unknown server" });
    return;
  }

  // Only one active tunnel per user in this MVP — drop any prior session first.
  const existing = getActiveSession(userId);
  if (existing) {
    await endSession(existing);
  }

  const assignedIp = allocateIp(serverId);

  try {
    await addPeer(server, clientPublicKey, assignedIp);
  } catch (err) {
    res.status(502).json({ error: `Could not reach VPN server: ${(err as Error).message}` });
    return;
  }

  db.prepare(
    "INSERT INTO sessions (user_id, server_id, client_public_key, assigned_ip) VALUES (?, ?, ?, ?)",
  ).run(userId, serverId, clientPublicKey, assignedIp);

  res.status(201).json({
    server: {
      id: server.id,
      name: server.name,
      city: server.city,
      country: server.country,
      endpointHost: server.endpointHost,
      endpointPort: server.endpointPort,
      serverPublicKey: server.serverPublicKey,
    },
    assignedIp,
    subnetCidr: server.subnetCidr,
    dns: server.dns,
    connectedAt: new Date().toISOString(),
  });
});

vpnRouter.post("/disconnect", async (req: AuthedRequest, res) => {
  const session = getActiveSession(req.userId!);
  if (!session) {
    res.status(200).json({ status: "already disconnected" });
    return;
  }
  await endSession(session);
  res.json({ status: "disconnected" });
});

vpnRouter.get("/status", (req: AuthedRequest, res) => {
  const session = getActiveSession(req.userId!);
  if (!session) {
    res.json({ connected: false });
    return;
  }
  const server = getServer(session.server_id);
  res.json({
    connected: true,
    server: server
      ? { id: server.id, name: server.name, city: server.city, country: server.country }
      : { id: session.server_id },
    assignedIp: session.assigned_ip,
    connectedAt: session.connected_at,
  });
});
