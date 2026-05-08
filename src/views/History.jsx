import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, thStyle, tdStyle, pill, colors } from "../lib/styles.js";

export function History({ templates, notify }) {
  const [tmpl, setTmpl] = useState(templates[0]?.template_key);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!tmpl) return;
    api.historyByTemplate(tmpl).then(setRows).catch(e => notify(e.message, "error"));
  }, [tmpl]);

  // Group by month
  const byMonth = rows.reduce((acc, r) => {
    (acc[r.snapshot_month] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>History</h1>
      <p style={{ color: colors.muted, margin: "0 0 20px", fontSize: 14 }}>
        Rolling 6-month SCD2 snapshots — every change keeps a versioned record.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {templates.map(t => (
          <button key={t.template_key} onClick={() => setTmpl(t.template_key)}
            style={{
              background: tmpl === t.template_key ? colors.brand : "#fff",
              color: tmpl === t.template_key ? "#fff" : colors.ink,
              border: "1px solid " + colors.line,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>{t.icon} {t.template_name}</button>
        ))}
      </div>

      {Object.keys(byMonth).length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: "center", color: colors.muted }}>
          No history within the rolling 6-month window.
        </div>
      ) : Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([m, mrows]) => (
        <div key={m} style={{ ...card, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ background: "#f8f9fb", padding: "10px 16px", fontWeight: 700, fontSize: 14, borderBottom: "1px solid " + colors.line }}>
            {m} — {mrows.length} change(s)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fcfcfd" }}>
                {["Business Key", "Change", "Changed By", "Valid From → To", "Snapshot"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {mrows.map(r => (
                <tr key={r.history_id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.business_key}</td>
                  <td style={tdStyle}><span style={pill("#fef9c3", "#a16207")}>{r.change_type}</span></td>
                  <td style={tdStyle}>{r.changed_by}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>
                    {new Date(r.valid_from).toLocaleString()} → {new Date(r.valid_to).toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: colors.muted, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {JSON.stringify(r.payload_json)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
