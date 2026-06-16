import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    server_id TEXT NOT NULL,
    client_public_key TEXT NOT NULL,
    assigned_ip TEXT NOT NULL,
    connected_at TEXT NOT NULL DEFAULT (datetime('now')),
    disconnected_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_active
    ON sessions(user_id) WHERE disconnected_at IS NULL;
`);
