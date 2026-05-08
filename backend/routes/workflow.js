import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";

const r = Router();

r.get("/requests", async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM mds_workflow_request WHERE (:s IS NULL OR status = :s) ORDER BY requested_at DESC`,
    { s: req.query.status ?? null }
  );
  res.json(normalizeRows(rows, ["payload_json"]));
});

r.get("/requests/:id/steps", async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM mds_workflow_step WHERE request_id = :id ORDER BY stage_order`,
    { id: req.params.id }
  );
  res.json(normalizeRows(rows));
});

r.post("/requests", async (req, res) => {
  const { template_key, requested_by, row_count, edited_count, payload, sql_table } = req.body;
  const id = "wr_" + randomUUID().slice(0, 10);
  await query(
    `INSERT INTO mds_workflow_request (request_id,template_key,requested_by,row_count,edited_count,payload_json,sql_table)
     VALUES (:id,:t,:u,:rc,:ec,:pl,:st)`,
    { id, t: template_key, u: requested_by, rc: row_count, ec: edited_count,
      pl: JSON.stringify(payload ?? {}), st: sql_table }
  );
  await query(
    `INSERT INTO mds_workflow_step (step_id,request_id,stage_name,stage_order,actor,action,acted_at)
     VALUES (:s,:id,'draft',1,:u,'submitted',SYSTIMESTAMP)`,
    { s: "ws_" + randomUUID().slice(0, 10), id, u: requested_by }
  );
  res.json({ request_id: id });
});

r.post("/requests/:id/transition", async (req, res) => {
  const { stage, action, actor, comment } = req.body;
  await query(
    `INSERT INTO mds_workflow_step (step_id,request_id,stage_name,stage_order,actor,action,comment_text,acted_at)
     VALUES (:s,:id,:st,(SELECT NVL(MAX(stage_order),0)+1 FROM mds_workflow_step WHERE request_id = :id),:a,:ac,:c,SYSTIMESTAMP)`,
    { s: "ws_" + randomUUID().slice(0, 10), id: req.params.id, st: stage, a: actor, ac: action, c: comment ?? null }
  );
  if (action === "approved" || action === "rejected") {
    await query(
      `UPDATE mds_workflow_request SET status = :st, current_stage = :stg, resolved_at = SYSTIMESTAMP WHERE request_id = :id`,
      { st: action, stg: stage, id: req.params.id }
    );
  } else {
    await query(
      `UPDATE mds_workflow_request SET current_stage = :stg WHERE request_id = :id`,
      { stg: stage, id: req.params.id }
    );
  }
  res.json({ ok: true });
});

export default r;
