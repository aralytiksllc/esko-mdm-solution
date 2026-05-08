import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/", async (req, res) => {
  const { status, assigned_to } = req.query;
  let sql = `SELECT * FROM mds_stewardship_task WHERE 1=1`;
  const binds = {};
  if (status) { sql += ` AND status = :status`; binds.status = status; }
  if (assigned_to) { sql += ` AND assigned_to = :a`; binds.a = assigned_to; }
  sql += ` ORDER BY
    CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'med' THEN 2 ELSE 3 END,
    created_at DESC`;
  const { rows } = await query(sql, binds);
  res.json(normalizeRows(rows));
});

r.get("/summary", async (_req, res) => {
  const { rows } = await query(
    `SELECT task_type, status, COUNT(*) AS cnt
     FROM mds_stewardship_task GROUP BY task_type, status`
  );
  res.json(normalizeRows(rows));
});

r.put("/:id", async (req, res) => {
  const { status, assigned_to } = req.body;
  await query(
    `UPDATE mds_stewardship_task
     SET status = COALESCE(:st, status),
         assigned_to = COALESCE(:a, assigned_to),
         resolved_at = CASE WHEN :st IN ('resolved','dismissed') THEN SYSTIMESTAMP ELSE resolved_at END,
         resolved_by = CASE WHEN :st IN ('resolved','dismissed') THEN :u ELSE resolved_by END
     WHERE task_id = :id`,
    { st: status ?? null, a: assigned_to ?? null, u: req.body.user ?? "system", id: req.params.id }
  );
  res.json({ ok: true });
});

export default r;
