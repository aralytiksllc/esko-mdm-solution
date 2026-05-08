import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Modal } from "./Modal.jsx";
import { btn, colors, pill } from "../lib/styles.js";

// Props:
//   onClose, currentUser, notify
//   provIds: { sql?: string, lakehouse?: string }   — fresh provisioning rows just generated
export function DDLPreviewModal({ onClose, currentUser, notify, provIds }) {
  const [tab, setTab] = useState("sql");
  const [rows, setRows] = useState({ sql: null, lakehouse: null });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    async function load() {
      const next = { sql: null, lakehouse: null };
      if (provIds?.sql) {
        try { next.sql = await api.provisioningById(provIds.sql); } catch {}
      }
      if (provIds?.lakehouse) {
        try { next.lakehouse = await api.provisioningById(provIds.lakehouse); } catch {}
      }
      setRows(next);
    }
    load();
  }, [provIds?.sql, provIds?.lakehouse]);

  async function deploy(target) {
    const row = rows[target];
    if (!row) return;
    setBusy(target);
    try {
      await api.deployProvisioning(row.prov_id, {
        user: currentUser?.user_id ?? "system",
        comment: comment || null,
      });
      const fresh = await api.provisioningById(row.prov_id);
      setRows(s => ({ ...s, [target]: fresh }));
      notify(`✓ ${target === "sql" ? "SQL Server" : "Lakehouse"} schema marked deployed`, "success");
    } catch (e) { notify(e.message, "error"); }
    finally { setBusy(null); }
  }

  function download(target) {
    const row = rows[target];
    if (!row) return;
    const ext = target === "sql" ? "sql" : "sql";
    const fname = `${row.template_key}-${row.ddl_kind}-${target}.${ext}`;
    const blob = new Blob([row.ddl_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copy(target) {
    const row = rows[target];
    if (!row) return;
    navigator.clipboard.writeText(row.ddl_text).then(
      () => notify("Copied DDL to clipboard", "success"),
      () => notify("Copy failed", "error"),
    );
  }

  const cur = rows[tab];

  return (
    <Modal title="Schema provisioning required" onClose={onClose} width={760}>
      <div style={{ fontSize: 13 }}>
        <p style={{ color: colors.muted, margin: "0 0 14px" }}>
          The MDS catalog has been updated. Apply the DDL below to your{" "}
          <strong>SQL Server</strong> and <strong>Fabric Lakehouse Bronze</strong> targets through your normal change pipeline,
          then mark each side as deployed. <strong>Submit to SQL / Lakehouse is blocked</strong> until both are deployed.
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { k: "sql", label: "SQL Server" },
            { k: "lakehouse", label: "Lakehouse Bronze" },
          ].map(t => {
            const r = rows[t.k];
            const status = r?.status ?? "—";
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  border: `1px solid ${tab === t.k ? "#7c3aed" : "#d1d5db"}`,
                  background: tab === t.k ? "#f5f3ff" : "#fff",
                  color: tab === t.k ? "#7c3aed" : colors.muted,
                  cursor: "pointer", fontWeight: 600, fontSize: 13,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                <span>{t.label}</span>
                <span style={pill(
                  status === "deployed" ? "#f0fdf4" : status === "pending" ? "#fffbeb" : "#f3f4f6",
                  status === "deployed" ? "#16a34a" : status === "pending" ? "#d97706" : colors.muted,
                  { fontSize: 10 },
                )}>{status}</span>
              </button>
            );
          })}
        </div>

        {cur ? (
          <>
            <pre style={{
              background: "#0f172a", color: "#e2e8f0", borderRadius: 10,
              padding: 14, fontSize: 12, fontFamily: "Consolas, 'Courier New', monospace",
              maxHeight: 320, overflow: "auto", margin: 0, lineHeight: 1.5,
            }}>{cur.ddl_text}</pre>

            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button onClick={() => copy(tab)} style={btn("#6b7280", { fontSize: 12 })}>📋 Copy</button>
              <button onClick={() => download(tab)} style={btn(colors.accentBlue, { fontSize: 12 })}>⬇ Download .sql</button>
              <div style={{ flex: 1 }} />
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Deployment ref (optional, e.g. ticket DEVOPS-4521)"
                style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, width: 280 }}
              />
              <button
                onClick={() => deploy(tab)}
                disabled={cur.status !== "pending" || busy === tab}
                style={{
                  ...btn(colors.accentGreen, { fontSize: 12, fontWeight: 700 }),
                  opacity: cur.status !== "pending" ? 0.5 : 1,
                  cursor: cur.status !== "pending" ? "not-allowed" : "pointer",
                }}
              >
                {busy === tab ? "Marking…" : cur.status === "deployed" ? "✓ Deployed" : "Mark deployed"}
              </button>
            </div>

            {cur.status === "deployed" && (
              <div style={{ marginTop: 10, fontSize: 11, color: colors.muted }}>
                Deployed by <strong>{cur.deployed_by}</strong> ·{" "}
                {cur.deployed_at && new Date(cur.deployed_at).toLocaleString()}
                {cur.deployed_comment && <> · <em>{cur.deployed_comment}</em></>}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 20, color: colors.muted, textAlign: "center" }}>Loading DDL…</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={btn("#6b7280")}>Close</button>
        </div>
      </div>
    </Modal>
  );
}