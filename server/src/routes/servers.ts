import { Router } from "express";
import { servers } from "../servers.js";

export const serversRouter = Router();

serversRouter.get("/", (_req, res) => {
  res.json(servers.map(({ id, name, city, country }) => ({ id, name, city, country })));
});
