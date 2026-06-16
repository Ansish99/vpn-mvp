import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface VpnServer {
  id: string;
  name: string;
  city: string;
  country: string;
  endpointHost: string;
  endpointPort: number;
  serverPublicKey: string;
  agentUrl: string;
  subnetCidr: string; // e.g. 10.7.0.0/24
  dns: string;
}

const raw = fs.readFileSync(path.join(__dirname, "config", "servers.json"), "utf-8");
export const servers: VpnServer[] = JSON.parse(raw);

export function getServer(id: string): VpnServer | undefined {
  return servers.find((s) => s.id === id);
}

/** Returns the first two octets+third octet of the subnet, e.g. "10.7.0" from "10.7.0.0/24" */
export function subnetPrefix(server: VpnServer): string {
  const base = server.subnetCidr.split("/")[0]!;
  return base.split(".").slice(0, 3).join(".");
}
