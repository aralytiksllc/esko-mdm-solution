import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";
import {
  ddlCreateTableSql, ddlCreateTableDelta,
  ddlAddColumnSql, ddlAddColumnDelta,
  ddlDropColumnSql, ddlDropColumnDelta,
  ddlDropTableSql, ddlDropTableDelta,
} from "../lib/ddl.js";
import { enqueueProvisioning } from "./provisioning.js";

const r = Router();

const VALID_TYPES = new Set(["text", "number", "date", "select"]);

function slugifyKey(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

r.get("/", async (req, res) => {
  const role = req.query.role ?? null; // optional — when present, enrich each template with permissions for this role

  const { rows: tmplRows } = await query(
    `SELECT template_key, template_name, icon, sql_table, bronze_table,
            phase, approval_chain, supports_period_copy, period_lock_day,
            requires_approval
     FROM mds_template ORDER BY template_key`
  );
  const { rows: colRows } = await query(
    `SELECT template_key, column_ord, column_name, data_type,
            is_required, is_key, options_csv, validation_rule
     FROM mds_template_column ORDER BY template_key, column_ord`
  );

  let permsByTmpl = null;
  if (role) {
    const { rows: pRows } = await query(
      `SELECT template_key, action FROM mds_template_permission WHERE role_name = :r`,
      { r: role }
    );
    permsByTmpl = {};
    for (const p of normalizeRows(pRows)) {
      (permsByTmpl[p.template_key] = permsByTmpl[p.template_key] ?? new Set()).add(p.action);
    }
  }

  const templates = normalizeRows(tmplRows).map(t => {
    const perms = permsByTmpl?.[t.template_key];
    return {
      ...t,
      supports_period_copy: !!t.supports_period_copy,
      requires_approval: !!t.requires_approval,
      columns: normalizeRows(colRows)
        .filter(c => c.template_key === t.template_key)
        .map(c => ({
          name: c.column_name,
          type: c.data_type,
          required: !!c.is_required,
          isKey: !!c.is_key,
          options: c.options_csv ? c.options_csv.split(",").map(s => s.trim()) : [],
        })),
      permissions: role ? {
        view:    !!perms?.has("view"),
        edit:    !!perms?.has("edit"),
        submit:  !!perms?.has("submit"),
        approve: !!perms?.has("approve"),
        admin:   !!perms?.has("admin"),
      } : null,
    };
  });
  // If role-scoped, hide templates the role can't view at all
  res.json(role ? templates.filter(t => t.permissions?.view) : templates);
});

// ── Create new entity (template) — optionally cloned from another ──
r.post("/", async (req, res) => {
  const {
    template_key, template_name, icon = "📋",
    sql_table, bronze_table,
    phase = "Phase 3", approval_chain = "Data Steward",
    supports_period_copy = false, period_lock_day = null,
    columns = [],
    clone_from = null,
  } = req.body ?? {};

  if (!template_key || !template_name) {
    return res.status(400).json({ error: "template_key and template_name are required" });
  }
  const key = slugifyKey(template_key);
  if (!key) return res.status(400).json({ error: "template_key produces empty slug" });

  const { rows: dup } = await query(
    `SELECT 1 FROM mds_template WHERE template_key = :k`, { k: key }
  );
  if (dup.length) return res.status(409).json({ error: `template_key '${key}' already exists` });

  // Resolve final column set: either copy from clone source, or use provided
  let finalCols = columns;
  let finalTmpl = { template_name, icon, sql_table, bronze_table, phase, approval_chain, supports_period_copy, period_lock_day };

  if (clone_from) {
    const { rows: src } = await query(
      `SELECT template_name, icon, sql_table, bronze_table, phase, approval_chain,
              supports_period_copy, period_lock_day
         FROM mds_template WHERE template_key = :k`, { k: clone_from }
    );
    if (!src.length) return res.status(404).json({ error: `clone source '${clone_from}' not found` });
    const s = normalizeRows(src)[0];
    finalTmpl = {
      template_name,
      icon: icon ?? s.icon,
      sql_table: sql_table ?? `mds.${key}`,
      bronze_table: bronze_table ?? `brz_mds_${key}`,
      phase: phase ?? s.phase,
      approval_chain: approval_chain ?? s.approval_chain,
      supports_period_copy: supports_period_copy ?? !!s.supports_period_copy,
      period_lock_day: period_lock_day ?? s.period_lock_day,
    };
    if (!columns.length) {
      const { rows: srcCols } = await query(
        `SELECT column_name, data_type, is_required, is_key, options_csv, validation_rule
           FROM mds_template_column WHERE template_key = :k ORDER BY column_ord`,
        { k: clone_from }
      );
      finalCols = normalizeRows(srcCols).map(c => ({
        name: c.column_name, type: c.data_type,
        required: !!c.is_required, isKey: !!c.is_key,
        options: c.options_csv ? c.options_csv.split(",").map(s => s.trim()) : [],
      }));
    }
  }

  if (!finalCols.length) {
    return res.status(400).json({ error: "at least one column is required" });
  }

  await query(
    `INSERT INTO mds_template (template_key, template_name, icon, sql_table, bronze_table,
                               phase, approval_chain, supports_period_copy, period_lock_day)
     VALUES (:k, :n, :ic, :st, :bt, :ph, :ac, :spc, :pld)`,
    {
      k: key,
      n: finalTmpl.template_name,
      ic: finalTmpl.icon,
      st: finalTmpl.sql_table ?? `mds.${key}`,
      bt: finalTmpl.bronze_table ?? `brz_mds_${key}`,
      ph: finalTmpl.phase,
      ac: finalTmpl.approval_chain,
      spc: finalTmpl.supports_period_copy ? 1 : 0,
      pld: finalTmpl.period_lock_day,
    }
  );

  for (let i = 0; i < finalCols.length; i++) {
    const c = finalCols[i];
    if (!c.name || !c.type) continue;
    if (!VALID_TYPES.has(c.type)) {
      return res.status(400).json({ error: `column '${c.name}' has invalid type '${c.type}'` });
    }
    await query(
      `INSERT INTO mds_template_column
        (template_key, column_ord, column_name, data_type, is_required, is_key, options_csv)
       VALUES (:k, :ord, :nm, :dt, :req, :ik, :opt)`,
      {
        k: key, ord: i + 1, nm: c.name, dt: c.type,
        req: c.required ? 1 : 0,
        ik: c.isKey || i === 0 ? 1 : 0,
        opt: Array.isArray(c.options) && c.options.length ? c.options.join(",") : null,
      }
    );
  }

  // Seed default per-object permissions (SC-02)
  const PERM_DEFAULTS = {
    Admin:   ["view","edit","submit","approve","admin"],
    Steward: ["view","edit","submit","approve"],
    Editor:  ["view","edit","submit"],
    Viewer:  ["view"],
  };
  for (const [role, actions] of Object.entries(PERM_DEFAULTS)) {
    for (const action of actions) {
      try {
        await query(
          `INSERT INTO mds_template_permission (template_key, role_name, action) VALUES (:k, :r, :a)`,
          { k: key, r: role, a: action }
        );
      } catch { /* PK conflict on retry — ignore */ }
    }
  }

  // Enqueue CREATE TABLE DDL for both targets
  const tmplForDdl = {
    template_key: key,
    sql_table: finalTmpl.sql_table ?? `mds.${key}`,
    bronze_table: finalTmpl.bronze_table ?? `brz_mds_${key}`,
  };
  const colsForDdl = finalCols.map((c, i) => ({
    name: c.name, type: c.type,
    required: !!c.required, isKey: !!(c.isKey || i === 0),
    options: Array.isArray(c.options) ? c.options : [],
  }));
  const sqlProvId = await enqueueProvisioning({
    template_key: key, target: "sql", ddl_kind: "create_table",
    ddl_text: ddlCreateTableSql(tmplForDdl, colsForDdl),
    generated_by: req.body?.user ?? "system",
  });
  const lhProvId = await enqueueProvisioning({
    template_key: key, target: "lakehouse", ddl_kind: "create_table",
    ddl_text: ddlCreateTableDelta(tmplForDdl, colsForDdl),
    generated_by: req.body?.user ?? "system",
  });

  res.status(201).json({
    template_key: key, columns: finalCols.length, cloned_from: clone_from || null,
    provisioning: { sql: sqlProvId, lakehouse: lhProvId },
  });
});

// ── Add column to an existing template ──
r.post("/:template_key/columns", async (req, res) => {
  const { template_key } = req.params;
  const { name, type = "text", required = false, isKey = false, options = [] } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  if (!VALID_TYPES.has(type)) return res.status(400).json({ error: `invalid type '${type}'` });

  const { rows: tmplRow } = await query(
    `SELECT 1 FROM mds_template WHERE template_key = :k`, { k: template_key }
  );
  if (!tmplRow.length) return res.status(404).json({ error: "template not found" });

  const { rows: dup } = await query(
    `SELECT 1 FROM mds_template_column WHERE template_key = :k AND LOWER(column_name) = LOWER(:n)`,
    { k: template_key, n: name }
  );
  if (dup.length) return res.status(409).json({ error: `column '${name}' already exists` });

  const { rows: maxRow } = await query(
    `SELECT NVL(MAX(column_ord), 0) AS max_ord FROM mds_template_column WHERE template_key = :k`,
    { k: template_key }
  );
  const ord = (normalizeRows(maxRow)[0].max_ord ?? 0) + 1;

  await query(
    `INSERT INTO mds_template_column
      (template_key, column_ord, column_name, data_type, is_required, is_key, options_csv)
     VALUES (:k, :ord, :nm, :dt, :req, :ik, :opt)`,
    {
      k: template_key, ord, nm: name, dt: type,
      req: required ? 1 : 0, ik: isKey ? 1 : 0,
      opt: Array.isArray(options) && options.length ? options.join(",") : null,
    }
  );

  // Enqueue ALTER TABLE ADD COLUMN DDL for both targets
  const { rows: tRow } = await query(
    `SELECT sql_table, bronze_table FROM mds_template WHERE template_key = :k`, { k: template_key }
  );
  const { SQL_TABLE: sqlTable, BRONZE_TABLE: bronzeTable } = tRow[0];
  const tmpl = { template_key, sql_table: sqlTable, bronze_table: bronzeTable };
  const col = { name, type, required, isKey, options };
  const sqlProvId = await enqueueProvisioning({
    template_key, target: "sql", ddl_kind: "add_column", column_name: name,
    ddl_text: ddlAddColumnSql(tmpl, col), generated_by: req.body?.user ?? "system",
  });
  const lhProvId = await enqueueProvisioning({
    template_key, target: "lakehouse", ddl_kind: "add_column", column_name: name,
    ddl_text: ddlAddColumnDelta(tmpl, col), generated_by: req.body?.user ?? "system",
  });

  res.status(201).json({
    ok: true, column_ord: ord, name,
    provisioning: { sql: sqlProvId, lakehouse: lhProvId },
  });
});

// ── Delete an entity (template + columns + records) ──
r.delete("/:template_key", async (req, res) => {
  const { template_key } = req.params;
  const { rows } = await query(
    `SELECT 1 FROM mds_template WHERE template_key = :k`, { k: template_key }
  );
  if (!rows.length) return res.status(404).json({ error: "template not found" });

  // Snapshot table targets before delete so we can emit DROP TABLE DDL
  const { rows: tRow } = await query(
    `SELECT sql_table, bronze_table FROM mds_template WHERE template_key = :k`, { k: template_key }
  );
  const { SQL_TABLE: sqlTable, BRONZE_TABLE: bronzeTable } = tRow[0];
  const tmpl = { template_key, sql_table: sqlTable, bronze_table: bronzeTable };

  await query(`DELETE FROM mds_audit_log WHERE template_key = :k`, { k: template_key });
  await query(`DELETE FROM mds_record_history WHERE template_key = :k`, { k: template_key });
  await query(`DELETE FROM mds_golden_record WHERE template_key = :k`, { k: template_key });
  await query(`DELETE FROM mds_publish_log WHERE template_key = :k`, { k: template_key });
  await query(`DELETE FROM mds_template_column WHERE template_key = :k`, { k: template_key });
  await query(`DELETE FROM mds_template WHERE template_key = :k`, { k: template_key });

  // Supersede any prior pending provisioning for this template, then enqueue DROP DDL
  await query(
    `UPDATE mds_provisioning SET status='superseded' WHERE template_key=:k AND status='pending'`,
    { k: template_key }
  );
  const sqlProvId = await enqueueProvisioning({
    template_key, target: "sql", ddl_kind: "drop_table",
    ddl_text: ddlDropTableSql(tmpl), generated_by: req.body?.user ?? "system",
  });
  const lhProvId = await enqueueProvisioning({
    template_key, target: "lakehouse", ddl_kind: "drop_table",
    ddl_text: ddlDropTableDelta(tmpl), generated_by: req.body?.user ?? "system",
  });

  res.json({ ok: true, removed: template_key, provisioning: { sql: sqlProvId, lakehouse: lhProvId } });
});

// ── Remove column from an existing template ──
r.delete("/:template_key/columns/:column_name", async (req, res) => {
  const { template_key, column_name } = req.params;

  const { rows } = await query(
    `SELECT column_ord, is_key FROM mds_template_column
      WHERE template_key = :k AND LOWER(column_name) = LOWER(:n)`,
    { k: template_key, n: column_name }
  );
  if (!rows.length) return res.status(404).json({ error: "column not found" });
  const col = normalizeRows(rows)[0];
  if (col.is_key) return res.status(409).json({ error: "cannot remove a key column" });

  await query(
    `DELETE FROM mds_template_column
      WHERE template_key = :k AND LOWER(column_name) = LOWER(:n)`,
    { k: template_key, n: column_name }
  );

  // Enqueue ALTER TABLE DROP COLUMN DDL for both targets
  const { rows: tRow } = await query(
    `SELECT sql_table, bronze_table FROM mds_template WHERE template_key = :k`, { k: template_key }
  );
  const { SQL_TABLE: sqlTable, BRONZE_TABLE: bronzeTable } = tRow[0];
  const tmpl = { template_key, sql_table: sqlTable, bronze_table: bronzeTable };
  const sqlProvId = await enqueueProvisioning({
    template_key, target: "sql", ddl_kind: "drop_column", column_name,
    ddl_text: ddlDropColumnSql(tmpl, column_name), generated_by: req.body?.user ?? "system",
  });
  const lhProvId = await enqueueProvisioning({
    template_key, target: "lakehouse", ddl_kind: "drop_column", column_name,
    ddl_text: ddlDropColumnDelta(tmpl, column_name), generated_by: req.body?.user ?? "system",
  });

  res.json({ ok: true, removed: column_name, provisioning: { sql: sqlProvId, lakehouse: lhProvId } });
});

export default r;
