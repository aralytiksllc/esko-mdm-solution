import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, pill, colors, thStyle, tdStyle } from "../lib/styles.js";

export function Provisioning({ currentUser, notify }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [expanded, setExpanded] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(null);

  async function reload() {
    try {
      const params = filter === "all" ? {} : { status: filter };
      setRows(await api.provisioning(params));
    } catch (e) { notify(e.message, "error"); }
  }

  useEffect(() => { reload(); }, [filter]);

  async function deploy(id) {
    setBusy(id);
    try {
      await api.deployProvisioning(id, {
        user: currentUser?.user_id ?? "system", comment: comment || null,
      });
      notify("✓ Marked deployed", "success");
      setComment("");
      setExpanded(null);
      reload();
    } catch (e) { notify(e.message, "error"); }
    finally { setBusy(null); }
  }

  async function reject(id) {
    setBusy(id);
    try {
      await api.rejectProvisioning(id, {
        user: currentUser?.user_id ?? "system", comment: comment || null,
      });
      notify("Rejected", "info");
      setComment("");
      setExpanded(null);
      reload();
    } catch (e) { notify(e.message, "error"); }
    finally { setBusy(null); }
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(
      () => notify("Copied", "success"),
      () => notify("Copy failed", "error"),
    );
  }

  function statusPill(s) {
    if (s === "pending")    return pill("#fffbeb", "#d97706");
    if (s === "deployed")   return pill("#f0fdf4", "#16a34a");
    if (s === "rejected")   return pill("#fef2f2", "#dc2626");
    if (s === "superseded") return pill("#f3f4f6", colors.muted);
    return pill("#f3f4f6", colors.muted);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>Provisioning queue</h1>
          <p style={{ color: colors.muted, margin: "4px 0 0", fontSize: 13 }}>
            DDL bundles awaiting deployment to SQL Server / Fabric Lakehouse Bronze.
            Apply each script through your normal change pipeline, then mark deployed.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["pending", "deployed", "rejected", "superseded", "all"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${filter === s ? "#7c3aed" : "#d1d5db"}`,
                background: filter === s ? "#f5f3ff" : "#fff",
                color: filter === s ? "#7c3aed" : colors.muted,
                cursor: "pointer", textTransform: "capitalize",
              }}>{s}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center", color: colors.muted }}>
          No {filter === "all" ? "" : filter} provisioning rows.
        </div>
      ) : (
        <div style={{ ...card, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8f9fb" }}>
                <th style={thStyle}>Entity</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Kind</th>
                <th style={thStyle}>Column</th>
                <th style={thStyle}>Generated</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <>
                  <tr key={r.prov_id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={tdStyle}><strong>{r.template_key}</strong></td>
                    <td style={tdStyle}>
                      <span style={pill(
                        r.target === "sql" ? "#dbeafe" : "#ede9fe",
                        r.target === "sql" ? "#1e40af" : "#6d28d9",
                      )}>{r.target === "sql" ? "SQL Server" : "Lakehouse"}</span>
                    </td>
                    <td style={tdStyle}><code style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{r.ddl_kind}</code></td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.column_name ?? "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: colors.muted }}>
                      {new Date(r.generated_at).toLocaleString()}
                      <div>by {r.generated_by}</div>
                    </td>
                    <td style={tdStyle}><span style={statusPill(r.status)}>{r.status}</span></td>
                    <td style={tdStyle}>
                      <button onClick={() => setExpanded(expanded === r.prov_id ? null : r.prov_id)}
                        style={{ ...btn("#eff6ff", { fontSize: 11, padding: "4px 10px" }), color: "#2563eb" }}>
                        {expanded === r.prov_id ? "Hide" : "View DDL"}
                      </button>
                    </td>
                  </tr>
                  {expanded === r.prov_id && (
                    <tr>
                      <td colSpan={7} style={{ padding: "10px 14px", background: "#fafbfc", borderBottom: "1px solid #f3f4f6" }}>
                        <pre style={{
                          background: "#0f172a", color: "#e2e8f0", borderRadius: 10,
                          padding: 14, fontSize: 12, fontFamily: "Consolas, monospace",
                          maxHeight: 240, overflow: "auto", margin: 0, lineHeight: 1.5,
                        }}>{r.ddl_text}</pre>
                        {r.status === "pending" && (
                          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                            <button onClick={() => copy(r.ddl_text)} style={btn("#6b7280", { fontSize: 11 })}>📋 Copy</button>
                            <input value={comment} onChange={e => setComment(e.target.value)}
                              placeholder="Deployment ref (optional)"
                              style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }} />
                            <button onClick={() => reject(r.prov_id)} disabled={busy === r.prov_id}
                              style={btn("#fef2f2", { fontSize: 11, color: "#dc2626" })}>Reject</button>
                            <button onClick={() => deploy(r.prov_id)} disabled={busy === r.prov_id}
                              style={btn(colors.accentGreen, { fontSize: 11, fontWeight: 700 })}>
                              {busy === r.prov_id ? "…" : "Mark deployed"}
                            </button>
                          </div>
                        )}
                        {r.status === "deployed" && (
                          <div style={{ marginTop: 8, fontSize: 11, color: colors.muted }}>
                            Deployed by <strong>{r.deployed_by}</strong> · {new Date(r.deployed_at).toLocaleString()}
                            {r.deployed_comment && <> · <em>{r.deployed_comment}</em></>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}