import cors from "cors";
import express from "express";
import { config } from "./config.js";
import "./db/index.js";
import { authRouter } from "./routes/auth.js";
import { serversRouter } from "./routes/servers.js";
import { vpnRouter } from "./routes/vpn.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/servers", serversRouter);
app.use("/api/vpn", vpnRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Central API listening on http://localhost:${config.port}`);
});
