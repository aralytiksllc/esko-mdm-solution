import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, pill, thStyle, tdStyle, dqColor, colors } from "../lib/styles.js";

const DIMENSIONS = ["completeness", "uniqueness", "validity", "timeliness"];

export function DataQuality({ templates, notify }) {
  const [overview, setOverview] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    Promise.all([api.dqOverview(), api.dqScorecards(), api.dqRules()])
      .then(([o, s, r]) => { setOverview(o); setScorecards(s); setRules(r); })
      .catch(e => notify(e.message, "error"));
  }, []);

  function nameOf(k) { return templates.find(t => t.template_key === k)?.template_name ?? k; }
  function iconOf(k) { return templates.find(t => t.template_key === k)?.icon ?? ""; }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Data Quality</h1>
      <p style={{ color: colors.muted, margin: "0 0 20px", fontSize: 14 }}>
        DQ scorecards by dimension — Completeness · Uniqueness · Validity · Timeliness.
      </p>

      {/* Per-entity scorecards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14, marginBottom: 28 }}>
        {overview.map(o => (
          <div key={o.template_key} style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>{iconOf(o.template_key)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{nameOf(o.template_key)}</div>
                <div style={{ fontSize: 11, color: colors.muted }}>{o.template_key}</div>
              </div>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: `4px solid ${dqColor(o.overall)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 16, color: dqColor(o.overall),
              }}>{Math.round(o.overall)}</div>
            </div>
            {DIMENSIONS.map(dim => {
              const v = dim === "uniqueness" ? o.uniqueness_ : o[dim];
              return (
                <div key={dim} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: colors.muted, textTransform: "capitalize" }}>{dim}</span>
                    <span style={{ fontWeight: 600, color: dqColor(v) }}>{v ?? "—"}%</span>
                  </div>
                  <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3 }}>
                    <div style={{
                      width: `${v ?? 0}%`, height: "100%", borderRadius: 3,
                      background: dqColor(v), transition: "width .3s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rules */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>DQ Rules ({rules.length})</h2>
      <div style={{ ...card, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fb" }}>
              {["Entity", "Field", "Dimension", "Rule", "Severity", "Active"].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.rule_id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={tdStyle}>{r.template_key === "*" ? <em>Global</em> : nameOf(r.template_key)}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.field_name}</td>
                <td style={tdStyle}><span style={pill("#eff6ff", "#2563eb")}>{r.dimension}</span></td>
                <td style={tdStyle}>{r.rule_name}</td>
                <td style={tdStyle}>
                  <span style={pill(
                    r.severity === "error" ? "#fef2f2" : r.severity === "warn" ? "#fffbeb" : "#eff6ff",
                    r.severity === "error" ? "#dc2626" : r.severity === "warn" ? "#d97706" : "#2563eb",
                  )}>{r.severity}</span>
                </td>
                <td style={tdStyle}>{r.active ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
