import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/", async (_req, res) => {
  const { rows: tmpls } = await query(
    `SELECT t.template_key, t.template_name, t.icon,
            (SELECT COUNT(*) FROM mds_template_column c WHERE c.template_key = t.template_key) AS col_count,
            (SELECT COUNT(*) FROM mds_golden_record g WHERE g.template_key = t.template_key AND g.is_current=1) AS row_count
     FROM mds_template t`
  );
  const { rows: cols } = await query(
    `SELECT template_key, column_name, data_type, is_required, is_key
     FROM mds_template_column ORDER BY template_key, column_ord`
  );
  const { rows: rels } = await query(
    `SELECT relationship_id, from_template, to_template, from_field, to_field, cardinality, relationship_name
     FROM mds_entity_relationship`
  );

  const entities = normalizeRows(tmpls).map(t => ({
    ...t,
    fields: normalizeRows(cols).filter(c => c.template_key === t.template_key),
  }));

  res.json({ entities, relationships: normalizeRows(rels) });
});

export default r;
