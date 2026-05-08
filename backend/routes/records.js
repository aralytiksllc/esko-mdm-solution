import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";

const r = Router();

r.get("/:template_key", async (req, res) => {
  const { rows } = await query(
    `SELECT record_id, template_key, business_key, payload_json, dq_score,
            source_system, match_group_id, status, modified_by, modified_at
     FROM mds_golden_record
     WHERE template_key = :t AND is_current = 1
     ORDER BY business_key`,
    { t: req.params.template_key }
  );
  res.json(normalizeRows(rows, ["payload_json"]));
});

r.post("/:template_key", async (req, res) => {
  const { business_key, payload, source_system, user } = req.body;
  const id = "gr_" + randomUUID().slice(0, 12);
  await query(
    `INSERT INTO mds_golden_record (record_id,template_key,business_key,payload_json,source_system,created_by,modified_by)
     VALUES (:id, :t, :bk, :pl, :ss, :u, :u)`,
    {
      id, t: req.params.template_key, bk: business_key,
      pl: JSON.stringify(payload), ss: source_system ?? "Manual", u: user ?? "system",
    }
  );
  await query(
    `INSERT INTO mds_audit_log (audit_id,record_id,template_key,business_key,action_type,new_value,actor,batch_id)
     VALUES (:a,:r,:t,:bk,'create',:nv,:u,:b)`,
    { a: "al_" + randomUUID().slice(0, 10), r: id, t: req.params.template_key, bk: business_key,
      nv: JSON.stringify(payload), u: user ?? "system", b: "b_" + Date.now() }
  );
  res.json({ record_id: id });
});

r.put("/:record_id", async (req, res) => {
  const { payload, user, changed_fields } = req.body;
  // snapshot current row into history
  const { rows } = await query(
    `SELECT template_key, business_key, payload_json, modified_at FROM mds_golden_record WHERE record_id = :id`,
    { id: req.params.record_id }
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  const prior = normalizeRows(rows, ["payload_json"])[0];

  await query(
    `INSERT INTO mds_record_history (history_id,record_id,template_key,business_key,payload_json,valid_from,valid_to,change_type,changed_by)
     VALUES (:h,:r,:t,:bk,:pl,:vf,SYSTIMESTAMP,'update',:u)`,
    {
      h: "h_" + randomUUID().slice(0, 10),
      r: req.params.record_id,
      t: prior.template_key,
      bk: prior.business_key,
      pl: JSON.stringify(prior.payload_json),
      vf: prior.modified_at ?? new Date(),
      u: user ?? "system",
    }
  );

  await query(
    `UPDATE mds_golden_record SET payload_json = :pl, modified_by = :u, modified_at = SYSTIMESTAMP WHERE record_id = :id`,
    { pl: JSON.stringify(payload), u: user ?? "system", id: req.params.record_id }
  );

  for (const f of changed_fields ?? []) {
    await query(
      `INSERT INTO mds_audit_log (audit_id,record_id,template_key,business_key,action_type,field_name,old_value,new_value,actor,batch_id)
       VALUES (:a,:r,:t,:bk,'update',:fn,:ov,:nv,:u,:b)`,
      {
        a: "al_" + randomUUID().slice(0, 10),
        r: req.params.record_id,
        t: prior.template_key,
        bk: prior.business_key,
        fn: f.field,
        ov: String(f.old ?? ""),
        nv: String(f.new ?? ""),
        u: user ?? "system",
        b: "b_" + Date.now(),
      }
    );
  }
  res.json({ ok: true });
});

r.delete("/:record_id", async (req, res) => {
  await query(`UPDATE mds_golden_record SET status = 'retired', is_current = 0 WHERE record_id = :id`, { id: req.params.record_id });
  res.json({ ok: true });
});

// Bulk import — replace | append (upsert by business_key)
r.post("/:template_key/bulk", async (req, res) => {
  const { rows = [], mode = "append", source_system = "Upload", user = "system" } = req.body;
  const tmpl = req.params.template_key;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows must be a non-empty array" });
  }

  const batchId = "b_" + Date.now();
  let added = 0, updated = 0, skipped = 0, retired = 0;
  const duplicates = []; // within-batch repeats

  const { rows: existingRaw } = await query(
    `SELECT record_id, business_key, payload_json FROM mds_golden_record WHERE template_key = :t AND is_current = 1`,
    { t: tmpl }
  );
  const existing = normalizeRows(existingRaw, ["payload_json"]);
  const byKey = new Map(existing.map(e => [e.business_key, e]));

  if (mode === "replace") {
    for (const e of existing) {
      await query(
        `UPDATE mds_golden_record SET status = 'retired', is_current = 0, modified_by = :u, modified_at = SYSTIMESTAMP WHERE record_id = :id`,
        { u: user, id: e.record_id }
      );
      retired++;
    }
    byKey.clear();
  }

  // Pre-flight: detect repeats within this batch (last-occurrence-wins semantics)
  const seen = new Map(); // business_key -> last index
  rows.forEach((row, i) => {
    const k = row.business_key ?? "";
    if (!k) return;
    if (seen.has(k)) duplicates.push({ key: k, indexes: [seen.get(k), i] });
    seen.set(k, i);
  });
  // Keep only the LAST occurrence of each duplicate key, drop earlier ones from processing
  const lastIdxByKey = new Map();
  rows.forEach((row, i) => { if (row.business_key) lastIdxByKey.set(row.business_key, i); });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const business_key = row.business_key ?? "";
    if (!business_key) { skipped++; continue; }
    // Skip earlier occurrences of a within-batch duplicate
    if (lastIdxByKey.get(business_key) !== i) { skipped++; continue; }
    const payload = row.payload ?? row;

    const prior = byKey.get(business_key);
    if (prior && mode !== "replace") {
      const isSame = JSON.stringify(prior.payload_json) === JSON.stringify(payload);
      if (isSame) { skipped++; continue; }

      await query(
        `INSERT INTO mds_record_history (history_id,record_id,template_key,business_key,payload_json,valid_from,valid_to,change_type,changed_by)
         VALUES (:h,:r,:t,:bk,:pl,SYSTIMESTAMP - NUMTODSINTERVAL(1,'SECOND'),SYSTIMESTAMP,'update',:u)`,
        { h: "h_" + randomUUID().slice(0, 10), r: prior.record_id, t: tmpl, bk: business_key,
          pl: JSON.stringify(prior.payload_json), u: user }
      );
      await query(
        `UPDATE mds_golden_record SET payload_json = :pl, source_system = :ss, modified_by = :u, modified_at = SYSTIMESTAMP WHERE record_id = :id`,
        { pl: JSON.stringify(payload), ss: source_system, u: user, id: prior.record_id }
      );
      await query(
        `INSERT INTO mds_audit_log (audit_id,record_id,template_key,business_key,action_type,new_value,actor,batch_id,comment_text)
         VALUES (:a,:r,:t,:bk,'update',:nv,:u,:b,'bulk import')`,
        { a: "al_" + randomUUID().slice(0, 10), r: prior.record_id, t: tmpl, bk: business_key,
          nv: JSON.stringify(payload), u: user, b: batchId }
      );
      updated++;
    } else {
      const id = "gr_" + randomUUID().slice(0, 12);
      await query(
        `INSERT INTO mds_golden_record (record_id,template_key,business_key,payload_json,source_system,created_by,modified_by)
         VALUES (:id,:t,:bk,:pl,:ss,:u,:u)`,
        { id, t: tmpl, bk: business_key, pl: JSON.stringify(payload), ss: source_system, u: user }
      );
      await query(
        `INSERT INTO mds_audit_log (audit_id,record_id,template_key,business_key,action_type,new_value,actor,batch_id,comment_text)
         VALUES (:a,:r,:t,:bk,'create',:nv,:u,:b,'bulk import')`,
        { a: "al_" + randomUUID().slice(0, 10), r: id, t: tmpl, bk: business_key,
          nv: JSON.stringify(payload), u: user, b: batchId }
      );
      // Record into byKey so a later duplicate within this batch updates rather than re-inserts
      byKey.set(business_key, { record_id: id, business_key, payload_json: payload });
      added++;
    }
  }
  res.json({ added, updated, skipped, retired, duplicates, batch_id: batchId });
});

export default r;
