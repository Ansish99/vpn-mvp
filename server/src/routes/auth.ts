import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/index.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function issueToken(userId: number) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "30d" });
}

authRouter.post("/register", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, passwordHash);

  const token = issueToken(Number(result.lastInsertRowid));
  res.status(201).json({ token, email });
});

authRouter.post("/login", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email) as { id: number; password_hash: string } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = issueToken(user.id);
  res.json({ token, email });
});
