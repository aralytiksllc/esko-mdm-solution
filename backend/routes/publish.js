import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";

const r = Router();

// Latest publish status for ALL templates (or one)
r.get("/status/:template_key?", async (req, res) => {
  const sql = req.params.template_key
    ? `SELECT * FROM mds_publish_log WHERE template_key = :t ORDER BY submitted_at DESC`
    : `SELECT * FROM mds_publish_log ORDER BY submitted_at DESC`;
  const binds = req.params.template_key ? { t: req.params.template_key } : {};
  const { rows } = await query(sql, binds);
  const all = normalizeRows(rows);

  // Latest per (template_key, target)
  const latest = {};
  for (const r of all) {
    const k = `${r.template_key}|${r.target}`;
    if (!latest[k]) latest[k] = r;
  }
  res.json({ latest: Object.values(latest), all });
});

// Submit (publish to local SQL target — mds.<table> in client production)
r.post("/sql/:template_key", async (req, res) => {
  const { user = "system", role = null } = req.body;
  const tmpl = req.params.template_key;

  // Gate 0: per-object RBAC (SC-02) — role must have 'submit' on this template
  if (role) {
    const { rows: perm } = await query(
      `SELECT 1 FROM mds_template_permission WHERE template_key=:t AND role_name=:r AND action='submit'`,
      { t: tmpl, r: role }
    );
    if (!perm.length) {
      return res.status(403).json({ error: `Role '${role}' is not permitted to submit '${tmpl}'.` });
    }
  }

  const { rows: tmplRow } = await query(
    `SELECT sql_table, bronze_table, requires_approval FROM mds_template WHERE template_key = :t`, { t: tmpl }
  );
  if (!tmplRow.length) return res.status(404).json({ error: "template not found" });
  const { SQL_TABLE: sqlTable, BRONZE_TABLE: bronzeTable, REQUIRES_APPROVAL: reqAppr } = tmplRow[0];

  // Gate 1: approval (AW-01/02) — if template requires approval, need an approved request newer than last submit
  if (reqAppr) {
    const { rows: appr } = await query(
      `SELECT request_id, requested_by, resolved_at FROM mds_workflow_request
        WHERE template_key=:t AND status='approved'
          AND resolved_at > NVL(
            (SELECT MAX(submitted_at) FROM mds_publish_log WHERE template_key=:t AND target='sql'),
            TO_TIMESTAMP('1970-01-01','YYYY-MM-DD'))
        ORDER BY resolved_at DESC FETCH FIRST 1 ROWS ONLY`,
      { t: tmpl }
    );
    if (!appr.length) {
      return res.status(409).json({
        error: "Approval required — no approved workflow request newer than last submit. Submit for approval first.",
        requires_approval: true,
      });
    }
  }

  // Gate 2: SQL target schema must be deployed
  const { rows: pend } = await query(
    `SELECT ddl_kind, column_name FROM mds_provisioning
      WHERE template_key=:t AND target='sql' AND status='pending'`,
    { t: tmpl }
  );
  if (pend.length) {
    const detail = pend.map(p => p.COLUMN_NAME ? `${p.DDL_KIND}:${p.COLUMN_NAME}` : p.DDL_KIND).join(", ");
    return res.status(409).json({
      error: `SQL target schema not yet deployed (${pend.length} pending: ${detail}). Apply DDL via the Provisioning queue first.`,
      pending_count: pend.length,
    });
  }

  const { rows: cnt } = await query(
    `SELECT COUNT(*) AS c FROM mds_golden_record WHERE template_key = :t AND is_current = 1`, { t: tmpl }
  );
  const rowCount = cnt[0].C;
  const id = "pub_" + randomUUID().slice(0, 10);
  const batchId = "b_" + Date.now();

  await query(
    `INSERT INTO mds_publish_log (publish_id,template_key,target,status,row_count,sql_table,bronze_table,batch_id,submitted_by,message)
     VALUES (:id,:t,'sql','synced',:rc,:st,:bt,:b,:u,:msg)`,
    { id, t: tmpl, rc: rowCount, st: sqlTable, bt: bronzeTable, b: batchId, u: user,
      msg: `Promoted ${rowCount} rows from mds_golden_record → ${sqlTable}` }
  );
  await query(
    `INSERT INTO mds_audit_log (audit_id,template_key,action_type,new_value,actor,batch_id,comment_text)
     VALUES (:a,:t,'publish',:nv,:u,:b,'Submitted to local SQL')`,
    { a: "al_" + randomUUID().slice(0, 10), t: tmpl, nv: sqlTable, u: user, b: batchId }
  );

  res.json({ publish_id: id, target: "sql", sql_table: sqlTable, row_count: rowCount, status: "synced" });
});

// Submit to Lakehouse Bronze
r.post("/lakehouse/:template_key", async (req, res) => {
  const { user = "system", role = null } = req.body;
  const tmpl = req.params.template_key;

  // Gate 0: per-object RBAC — role must have 'submit' on this template
  if (role) {
    const { rows: perm } = await query(
      `SELECT 1 FROM mds_template_permission WHERE template_key=:t AND role_name=:r AND action='submit'`,
      { t: tmpl, r: role }
    );
    if (!perm.length) {
      return res.status(403).json({ error: `Role '${role}' is not permitted to publish '${tmpl}' to Lakehouse.` });
    }
  }

  const { rows: tmplRow } = await query(
    `SELECT sql_table, bronze_table FROM mds_template WHERE template_key = :t`, { t: tmpl }
  );
  if (!tmplRow.length) return res.status(404).json({ error: "template not found" });
  const { SQL_TABLE: sqlTable, BRONZE_TABLE: bronzeTable } = tmplRow[0];

  // Confirm an SQL publish exists first
  const { rows: sqlPub } = await query(
    `SELECT MAX(submitted_at) AS last FROM mds_publish_log WHERE template_key = :t AND target = 'sql' AND status = 'synced'`,
    { t: tmpl }
  );
  if (!sqlPub[0].LAST) {
    return res.status(409).json({ error: "Submit to local SQL first" });
  }

  // Gate: Lakehouse target schema must be deployed
  const { rows: pendLh } = await query(
    `SELECT ddl_kind, column_name FROM mds_provisioning
      WHERE template_key=:t AND target='lakehouse' AND status='pending'`,
    { t: tmpl }
  );
  if (pendLh.length) {
    const detail = pendLh.map(p => p.COLUMN_NAME ? `${p.DDL_KIND}:${p.COLUMN_NAME}` : p.DDL_KIND).join(", ");
    return res.status(409).json({
      error: `Lakehouse target schema not yet deployed (${pendLh.length} pending: ${detail}). Apply DDL via the Provisioning queue first.`,
      pending_count: pendLh.length,
    });
  }

  const { rows: cnt } = await query(
    `SELECT COUNT(*) AS c FROM mds_golden_record WHERE template_key = :t AND is_current = 1`, { t: tmpl }
  );
  const rowCount = cnt[0].C;
  const id = "pub_" + randomUUID().slice(0, 10);
  const batchId = "b_" + Date.now();

  await query(
    `INSERT INTO mds_publish_log (publish_id,template_key,target,status,row_count,sql_table,bronze_table,batch_id,submitted_by,message)
     VALUES (:id,:t,'lakehouse','synced',:rc,:st,:bt,:b,:u,:msg)`,
    { id, t: tmpl, rc: rowCount, st: sqlTable, bt: bronzeTable, b: batchId, u: user,
      msg: `Synced ${rowCount} rows → Fabric Lakehouse Bronze (${bronzeTable}) as Delta table` }
  );
  await query(
    `INSERT INTO mds_audit_log (audit_id,template_key,action_type,new_value,actor,batch_id,comment_text)
     VALUES (:a,:t,'publish',:nv,:u,:b,'Submitted to Lakehouse Bronze')`,
    { a: "al_" + randomUUID().slice(0, 10), t: tmpl, nv: bronzeTable, u: user, b: batchId }
  );

  res.json({ publish_id: id, target: "lakehouse", bronze_table: bronzeTable, row_count: rowCount, status: "synced" });
});

export default r;
