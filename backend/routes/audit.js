import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/record/:record_id", async (req, res) => {
  const { rows } = await query(
    `SELECT audit_id, action_type, field_name, old_value, new_value, actor, actor_role, action_at, comment_text
     FROM mds_audit_log WHERE record_id = :r ORDER BY action_at DESC`,
    { r: req.params.record_id }
  );
  res.json(normalizeRows(rows));
});

r.get("/template/:template_key", async (req, res) => {
  const { rows } = await query(
    `SELECT audit_id, record_id, business_key, action_type, field_name, old_value, new_value, actor, action_at
     FROM mds_audit_log WHERE template_key = :t ORDER BY action_at DESC FETCH FIRST 200 ROWS ONLY`,
    { t: req.params.template_key }
  );
  res.json(normalizeRows(rows));
});

export default r;
