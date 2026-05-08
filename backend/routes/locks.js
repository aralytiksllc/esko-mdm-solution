import { Router } from "express";
import { query, normalizeRows } from "../lib/db.js";

const r = Router();

// Get current lock (null if none/expired)
r.get("/:template_key", async (req, res, next) => {
  try {
    const t = req.params.template_key;
    await query(`DELETE FROM mds_template_lock WHERE template_key=:t AND expires_at < LOCALTIMESTAMP`, { t });
    const { rows } = await query(
      `SELECT template_key, locked_by, locked_by_name, locked_at, expires_at
         FROM mds_template_lock WHERE template_key=:t`, { t }
    );
    res.json(rows.length ? normalizeRows(rows)[0] : null);
  } catch (e) { next(e); }
});

// Acquire or extend the lock. Returns 409 if held by another user.
// Uses an atomic MERGE so concurrent acquires (HMR re-mounts, heartbeats) can't race
// into a unique-constraint violation.
r.post("/:template_key/acquire", async (req, res, next) => {
  try {
    const { user, name = null, ttl_seconds = 300 } = req.body ?? {};
    if (!user) return res.status(400).json({ error: "user required" });
    const t = req.params.template_key;

    const result = await query(
      `MERGE INTO mds_template_lock tl
       USING (SELECT :t AS template_key FROM dual) src
         ON (tl.template_key = src.template_key)
       WHEN MATCHED THEN
         UPDATE SET locked_by      = :u,
                    locked_by_name = :n,
                    expires_at     = LOCALTIMESTAMP + NUMTODSINTERVAL(:s, 'SECOND'),
                    locked_at      = LOCALTIMESTAMP
         WHERE tl.locked_by = :u OR tl.expires_at < LOCALTIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (template_key, locked_by, locked_by_name, expires_at)
         VALUES (:t, :u, :n, LOCALTIMESTAMP + NUMTODSINTERVAL(:s, 'SECOND'))`,
      { t, u: user, n: name ?? user, s: ttl_seconds }
    );

    // rowsAffected = 0 means a fresh lock exists owned by another user — the WHERE on
    // the WHEN MATCHED branch refused the update.
    if ((result.rowsAffected ?? 0) === 0) {
      const { rows } = await query(
        `SELECT locked_by, locked_by_name, expires_at FROM mds_template_lock WHERE template_key=:t`,
        { t }
      );
      const lock = rows.length ? normalizeRows(rows)[0] : null;
      if (lock && lock.locked_by !== user) {
        return res.status(409).json({
          error: `Locked by ${lock.locked_by_name || lock.locked_by}`,
          locked_by: lock.locked_by, locked_by_name: lock.locked_by_name, expires_at: lock.expires_at,
        });
      }
    }
    res.json({ ok: true, ttl_seconds });
  } catch (e) { next(e); }
});

// Release lock if owned by user
r.post("/:template_key/release", async (req, res, next) => {
  try {
    const { user } = req.body ?? {};
    if (!user) return res.status(400).json({ error: "user required" });
    await query(
      `DELETE FROM mds_template_lock WHERE template_key=:t AND locked_by=:u`,
      { t: req.params.template_key, u: user }
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;