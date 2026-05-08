import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/", async (_req, res) => {
  const { rows } = await query(
    `SELECT user_id, user_name, role_name, email, avatar_initials FROM mds_user WHERE active = 1`
  );
  res.json(normalizeRows(rows));
});

export default r;
