import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-do-not-use-in-prod",
  dbPath: process.env.DB_PATH ?? "./data/app.db",
  agentSharedSecret: process.env.AGENT_SHARED_SECRET ?? "dev-secret-do-not-use-in-prod",
  agentPort: Number(process.env.AGENT_PORT ?? 5000),
  wgInterface: process.env.WG_INTERFACE ?? "wg0",
};
