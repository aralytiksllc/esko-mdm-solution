import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";
import { randomUUID } from "crypto";

const r = Router();

r.get("/", async (_req, res) => {
  const { rows } = await query(
    `SELECT hierarchy_id, hierarchy_name, template_key, description FROM mds_hierarchy`
  );
  res.json(normalizeRows(rows));
});

r.get("/:id/tree", async (req, res) => {
  const { rows } = await query(
    `SELECT node_id, hierarchy_id, parent_node_id, record_id, node_label, node_level, sort_order
     FROM mds_hierarchy_node WHERE hierarchy_id = :id ORDER BY node_level, sort_order`,
    { id: req.params.id }
  );
  const nodes = normalizeRows(rows);
  // Build tree
  const map = new Map(nodes.map(n => [n.node_id, { ...n, children: [] }]));
  const roots = [];
  for (const n of map.values()) {
    if (n.parent_node_id && map.has(n.parent_node_id)) {
      map.get(n.parent_node_id).children.push(n);
    } else {
      roots.push(n);
    }
  }
  res.json(roots);
});

r.put("/nodes/:id/move", async (req, res) => {
  const { new_parent } = req.body;
  await query(
    `UPDATE mds_hierarchy_node SET parent_node_id = :p WHERE node_id = :id`,
    { p: new_parent || null, id: req.params.id }
  );
  res.json({ ok: true });
});

r.post("/:id/nodes", async (req, res) => {
  const { parent_node_id, node_label, record_id, node_level } = req.body;
  const id = "n_" + randomUUID().slice(0, 10);
  await query(
    `INSERT INTO mds_hierarchy_node (node_id,hierarchy_id,parent_node_id,record_id,node_label,node_level,sort_order)
     VALUES (:id,:h,:p,:r,:lbl,:lvl,0)`,
    { id, h: req.params.id, p: parent_node_id ?? null, r: record_id ?? null, lbl: node_label, lvl: node_level ?? 1 }
  );
  res.json({ node_id: id });
});

r.delete("/nodes/:id", async (req, res) => {
  await query(`DELETE FROM mds_hierarchy_node WHERE node_id = :id`, { id: req.params.id });
  res.json({ ok: true });
});

export default r;
