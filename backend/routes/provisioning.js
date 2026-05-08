import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";

const r = Router();

// ── Helper used by templates routes to enqueue a DDL bundle ──
export async function enqueueProvisioning({ template_key, target, ddl_kind, column_name, ddl_text, generated_by }) {
  const id = "prov_" + randomUUID().slice(0, 12);
  await query(
    `INSERT INTO mds_provisioning
       (prov_id, template_key, target, ddl_kind, column_name, ddl_text, generated_by)
     VALUES (:id, :tk, :tg, :kind, :col, :ddl, :gb)`,
    {
      id, tk: template_key, tg: target, kind: ddl_kind,
      col: column_name ?? null, ddl: ddl_text, gb: generated_by ?? "system",
    }
  );
  return id;
}

// ── List provisioning rows (queue / history) ──
r.get("/", async (req, res) => {
  const { status, template_key, target } = req.query;
  const where = [];
  const binds = {};
  if (status) { where.push("status = :st"); binds.st = status; }
  if (template_key) { where.push("template_key = :tk"); binds.tk = template_key; }
  if (target) { where.push("target = :tg"); binds.tg = target; }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT prov_id, template_key, target, ddl_kind, column_name, ddl_text,
            status, generated_at, generated_by, deployed_at, deployed_by, deployed_comment
       FROM mds_provisioning ${w}
       ORDER BY generated_at DESC`,
    binds
  );
  res.json(normalizeRows(rows, ["ddl_text"]));
});

// ── Single row ──
r.get("/:prov_id", async (req, res) => {
  const { rows } = await query(
    `SELECT prov_id, template_key, target, ddl_kind, column_name, ddl_text,
            status, generated_at, generated_by, deployed_at, deployed_by, deployed_comment
       FROM mds_provisioning WHERE prov_id = :id`,
    { id: req.params.prov_id }
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(normalizeRows(rows, ["ddl_text"])[0]);
});

// ── Mark a row as deployed ──
r.post("/:prov_id/deploy", async (req, res) => {
  const { user = "system", comment = null } = req.body ?? {};
  const { rows } = await query(
    `SELECT status FROM mds_provisioning WHERE prov_id = :id`, { id: req.params.prov_id }
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  if (normalizeRows(rows)[0].status !== "pending") {
    return res.status(409).json({ error: "row is not pending" });
  }
  await query(
    `UPDATE mds_provisioning
        SET status='deployed', deployed_at=SYSTIMESTAMP, deployed_by=:u, deployed_comment=:c
      WHERE prov_id=:id`,
    { u: user, c: comment, id: req.params.prov_id }
  );
  res.json({ ok: true });
});

// ── Mark a row as rejected ──
r.post("/:prov_id/reject", async (req, res) => {
  const { user = "system", comment = null } = req.body ?? {};
  await query(
    `UPDATE mds_provisioning
        SET status='rejected', deployed_at=SYSTIMESTAMP, deployed_by=:u, deployed_comment=:c
      WHERE prov_id=:id AND status='pending'`,
    { u: user, c: comment, id: req.params.prov_id }
  );
  res.json({ ok: true });
});

// ── Pending count grouped by template_key (for dashboard banners) ──
r.get("/_summary/pending", async (_req, res) => {
  const { rows } = await query(
    `SELECT template_key, target, COUNT(*) AS cnt
       FROM mds_provisioning WHERE status='pending'
      GROUP BY template_key, target`
  );
  res.json(normalizeRows(rows));
});

export default r;