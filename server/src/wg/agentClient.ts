import { config } from "../config.js";
import type { VpnServer } from "../servers.js";

/**
 * Talks to the wg-agent running on a given VPN server box (see wg/agentServer.ts).
 * The agent holds the actual `wg` privileges; the central API never touches
 * a WireGuard interface directly.
 */
export async function addPeer(server: VpnServer, clientPublicKey: string, allowedIp: string) {
  const res = await fetch(`${server.agentUrl}/peers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Secret": config.agentSharedSecret,
    },
    body: JSON.stringify({ publicKey: clientPublicKey, allowedIp }),
  });
  if (!res.ok) {
    throw new Error(`wg-agent addPeer failed (${res.status}): ${await res.text()}`);
  }
}

export async function removePeer(server: VpnServer, clientPublicKey: string) {
  const res = await fetch(`${server.agentUrl}/peers/${encodeURIComponent(clientPublicKey)}`, {
    method: "DELETE",
    headers: { "X-Agent-Secret": config.agentSharedSecret },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`wg-agent removePeer failed (${res.status}): ${await res.text()}`);
  }
}
