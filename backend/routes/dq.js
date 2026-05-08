import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/scorecards", async (_req, res) => {
  const { rows } = await query(
    `SELECT template_key, dimension, score, total_records, passed_records, measured_at
     FROM mds_dq_scorecard ORDER BY template_key, dimension`
  );
  res.json(normalizeRows(rows));
});

r.get("/rules/:template_key?", async (req, res) => {
  const bind = req.params.template_key ? { t: req.params.template_key } : {};
  const sql = req.params.template_key
    ? `SELECT * FROM mds_dq_rule WHERE template_key IN (:t, '*') AND active = 1`
    : `SELECT * FROM mds_dq_rule WHERE active = 1`;
  const { rows } = await query(sql, bind);
  res.json(normalizeRows(rows));
});

r.get("/overview", async (_req, res) => {
  const { rows } = await query(
    `SELECT template_key,
            ROUND(AVG(score),1) AS overall,
            ROUND(AVG(CASE WHEN dimension='completeness' THEN score END),1) AS completeness,
            ROUND(AVG(CASE WHEN dimension='uniqueness'   THEN score END),1) AS uniqueness_,
            ROUND(AVG(CASE WHEN dimension='validity'     THEN score END),1) AS validity,
            ROUND(AVG(CASE WHEN dimension='timeliness'   THEN score END),1) AS timeliness
     FROM mds_dq_scorecard GROUP BY template_key ORDER BY template_key`
  );
  res.json(normalizeRows(rows));
});

export default r;
