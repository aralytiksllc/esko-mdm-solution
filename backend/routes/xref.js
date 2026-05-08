import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/record/:record_id", async (req, res) => {
  const { rows } = await query(
    `SELECT xref_id, source_system, source_key, source_value, last_seen_at, is_active
     FROM mds_xref WHERE record_id = :r`,
    { r: req.params.record_id }
  );
  res.json(normalizeRows(rows));
});

r.get("/template/:template_key", async (req, res) => {
  const { rows } = await query(
    `SELECT x.xref_id, x.record_id, x.source_system, x.source_key, x.source_value, g.business_key
     FROM mds_xref x
     JOIN mds_golden_record g ON g.record_id = x.record_id
     WHERE g.template_key = :t
     ORDER BY g.business_key, x.source_system`,
    { t: req.params.template_key }
  );
  res.json(normalizeRows(rows));
});

export default r;
