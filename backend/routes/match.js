import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/groups", async (req, res) => {
  const { rows } = await query(
    `SELECT mg.match_group_id, mg.template_key, mg.status, mg.match_score,
            mg.rule_name, mg.created_at, mg.surviving_record
     FROM mds_match_group mg
     WHERE (:s IS NULL OR mg.status = :s)
     ORDER BY mg.created_at DESC`,
    { s: req.query.status ?? null }
  );
  res.json(normalizeRows(rows));
});

r.get("/groups/:id", async (req, res) => {
  const { rows: grp } = await query(
    `SELECT * FROM mds_match_group WHERE match_group_id = :id`,
    { id: req.params.id }
  );
  if (!grp.length) return res.status(404).json({ error: "not found" });
  const { rows: cands } = await query(
    `SELECT c.match_group_id, c.record_id, c.source_system, c.similarity, c.is_surviving,
            g.business_key, g.payload_json, g.dq_score
     FROM mds_match_candidate c
     JOIN mds_golden_record g ON g.record_id = c.record_id
     WHERE c.match_group_id = :id`,
    { id: req.params.id }
  );
  res.json({
    group: normalizeRows(grp)[0],
    candidates: normalizeRows(cands, ["payload_json"]),
  });
});

r.post("/groups/:id/resolve", async (req, res) => {
  const { surviving_record, merged_payload, user } = req.body;
  await query(
    `UPDATE mds_match_group SET status = 'merged', surviving_record = :sr, resolved_by = :u, resolved_at = SYSTIMESTAMP
     WHERE match_group_id = :id`,
    { sr: surviving_record, u: user, id: req.params.id }
  );
  // Retire the non-surviving record(s)
  await query(
    `UPDATE mds_golden_record SET status = 'merged', is_current = 0
     WHERE record_id IN (SELECT record_id FROM mds_match_candidate WHERE match_group_id = :id AND record_id <> :sr)`,
    { id: req.params.id, sr: surviving_record }
  );
  // Apply merged payload to survivor
  if (merged_payload) {
    await query(
      `UPDATE mds_golden_record SET payload_json = :pl, modified_by = :u, modified_at = SYSTIMESTAMP
       WHERE record_id = :sr`,
      { pl: JSON.stringify(merged_payload), u: user, sr: surviving_record }
    );
  }
  res.json({ ok: true });
});

r.post("/groups/:id/dismiss", async (req, res) => {
  await query(
    `UPDATE mds_match_group SET status = 'rejected', resolved_by = :u, resolved_at = SYSTIMESTAMP WHERE match_group_id = :id`,
    { u: req.body.user ?? "system", id: req.params.id }
  );
  res.json({ ok: true });
});

r.get("/survivorship-rules/:template_key", async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM mds_survivorship_rule WHERE template_key = :t AND active = 1`,
    { t: req.params.template_key }
  );
  res.json(normalizeRows(rows));
});

export default r;
