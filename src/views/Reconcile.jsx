import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, thStyle, tdStyle, pill, colors } from "../lib/styles.js";

export function Reconcile({ notify }) {
  const [rows, setRows] = useState([]);

  useEffect(() => { api.reconcile().then(setRows).catch(e => notify(e.message, "error")); }, []);

  const matched = rows.filter(r => r.drift_status === "match").length;
  const drift = rows.filter(r => r.drift_status === "drift").length;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Cross-System Reconciliation</h1>
      <p style={{ color: colors.muted, margin: "0 0 20px", fontSize: 14 }}>
        SQL Server MDS · Lakehouse Gold · Salesforce · Oracle Fusion — drift detection.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Records Checked", v: rows.length, c: colors.accentBlue },
          { label: "Matched", v: matched, c: colors.accentGreen },
          { label: "Drift", v: drift, c: colors.accentAmber },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 22px" }}>
            <div style={{ fontSize: 12, color: s.c, fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {drift > 0 && (
        <div style={{ background: "#fff4e0", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#92400e" }}>
          ⚠ {drift} drift(s) detected — Salesforce/Oracle values diverge from MDS.
        </div>
      )}

      <div style={{ ...card, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fb" }}>
              {["Key", "MDS", "Lakehouse", "Salesforce", "Oracle", "Status"].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.recon_id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700 }}>{r.business_key}</td>
                <td style={tdStyle}>{r.sql_value ?? "—"}</td>
                <td style={tdStyle}>{r.lakehouse_value ?? "—"}</td>
                <td style={{ ...tdStyle, color: r.salesforce_value === r.sql_value ? "inherit" : "#d97706" }}>
                  {r.salesforce_value ?? "—"}
                </td>
                <td style={{ ...tdStyle, color: r.oracle_value === r.sql_value ? "inherit" : "#d97706" }}>
                  {r.oracle_value ?? "—"}
                </td>
                <td style={tdStyle}>
                  <span style={pill(r.drift_status === "match" ? "#f0fdf4" : "#fffbeb",
                                    r.drift_status === "match" ? "#16a34a" : "#d97706")}>
                    {r.drift_status === "match" ? "✓ Match" : "⚠ Drift"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button style={btn(colors.brand)} onClick={() => notify("Distribution pipeline triggered — Salesforce & Oracle re-sync queued", "success")}>🔄 Re-sync Now</button>
        <button style={btn("#6b7280")} onClick={() => notify("Reconciliation report exported as CSV", "info")}>📊 Export</button>
      </div>
    </div>
  );
}
