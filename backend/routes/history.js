import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

r.get("/record/:record_id", async (req, res) => {
  const { rows } = await query(
    `SELECT history_id, business_key, payload_json, valid_from, valid_to, change_type, changed_by, snapshot_month
     FROM mds_record_history WHERE record_id = :r ORDER BY valid_from DESC`,
    { r: req.params.record_id }
  );
  res.json(normalizeRows(rows, ["payload_json"]));
});

// Rolling 6-month window per template
r.get("/template/:template_key", async (req, res) => {
  const { rows } = await query(
    `SELECT history_id, record_id, business_key, payload_json, valid_from, valid_to,
            change_type, changed_by, snapshot_month
     FROM mds_record_history
     WHERE template_key = :t
       AND valid_from > SYSTIMESTAMP - NUMTODSINTERVAL(180,'DAY')
     ORDER BY valid_from DESC`,
    { t: req.params.template_key }
  );
  res.json(normalizeRows(rows, ["payload_json"]));
});

// Purge older than 6 months (operational cleanup)
r.post("/purge", async (_req, res) => {
  const { rowsAffected } = await query(
    `DELETE FROM mds_record_history WHERE valid_from < SYSTIMESTAMP - NUMTODSINTERVAL(180,'DAY')`
  );
  res.json({ purged: rowsAffected });
});

export default r;
