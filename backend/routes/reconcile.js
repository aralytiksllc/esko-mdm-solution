import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM mds_reconciliation
     WHERE (:t IS NULL OR template_key = :t)
     ORDER BY drift_status DESC, business_key`,
    { t: req.query.template_key ?? null }
  );
  res.json(normalizeRows(rows));
});

r.get("/summary", async (_req, res) => {
  const { rows } = await query(
    `SELECT template_key,
            COUNT(*) AS total,
            SUM(CASE WHEN drift_status = 'match' THEN 1 ELSE 0 END) AS matched,
            SUM(CASE WHEN drift_status = 'drift' THEN 1 ELSE 0 END) AS drift
     FROM mds_reconciliation GROUP BY template_key`
  );
  res.json(normalizeRows(rows));
});

export default r;
