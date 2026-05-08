import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";

const r = Router();

r.get("/", async (_req, res) => {
  const { rows } = await query(
    `SELECT * FROM mds_glossary_term ORDER BY term_name`
  );
  res.json(normalizeRows(rows));
});

r.post("/", async (req, res) => {
  const { term_name, definition, category, owner, steward, related_template, related_field } = req.body;
  const id = "gt_" + randomUUID().slice(0, 10);
  await query(
    `INSERT INTO mds_glossary_term (term_id,term_name,definition,category,owner,steward,status,related_template,related_field)
     VALUES (:id,:n,:d,:c,:o,:s,'approved',:rt,:rf)`,
    { id, n: term_name, d: definition, c: category, o: owner, s: steward,
      rt: related_template ?? null, rf: related_field ?? null }
  );
  res.json({ term_id: id });
});

r.put("/:id", async (req, res) => {
  const b = req.body;
  await query(
    `UPDATE mds_glossary_term
     SET term_name=:n, definition=:d, category=:c, owner=:o, steward=:s,
         related_template=:rt, related_field=:rf, updated_at=SYSTIMESTAMP
     WHERE term_id = :id`,
    { n: b.term_name, d: b.definition, c: b.category, o: b.owner, s: b.steward,
      rt: b.related_template ?? null, rf: b.related_field ?? null, id: req.params.id }
  );
  res.json({ ok: true });
});

r.delete("/:id", async (req, res) => {
  await query(`DELETE FROM mds_glossary_term WHERE term_id = :id`, { id: req.params.id });
  res.json({ ok: true });
});

export default r;
