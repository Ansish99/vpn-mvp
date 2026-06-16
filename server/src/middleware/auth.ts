import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthedRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub: number };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
