import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, pill, colors } from "../lib/styles.js";

export function EntityModel({ notify }) {
  const [model, setModel] = useState(null);

  useEffect(() => { api.entityModel().then(setModel).catch(e => notify(e.message, "error")); }, []);

  if (!model) return <div style={{ padding: 24, color: colors.muted }}>Loading model…</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Entity Model</h1>
      <p style={{ color: colors.muted, margin: "0 0 24px", fontSize: 14 }}>
        Master data entities and the relationships between them.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, marginBottom: 28 }}>
        {model.entities.map(e => (
          <div key={e.template_key} style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid " + colors.line }}>
              <span style={{ fontSize: 22 }}>{e.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.template_name}</div>
                <div style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>{e.template_key}</div>
              </div>
              <span style={pill("#eff6ff", "#2563eb")}>{e.row_count} rows</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              {e.fields.map(f => (
                <div key={f.column_name} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontFamily: "monospace" }}>
                    {f.is_key ? "🔑 " : ""}{f.column_name}
                  </span>
                  <span style={{ color: colors.muted, fontSize: 11 }}>
                    {f.data_type}{f.is_required ? " ·required" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Relationships</h2>
      <div style={{ ...card, padding: 18 }}>
        {model.relationships.length === 0 ? (
          <div style={{ color: colors.muted }}>No relationships defined.</div>
        ) : model.relationships.map(r => (
          <div key={r.relationship_id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
            borderBottom: "1px solid " + colors.line,
          }}>
            <span style={pill("#f3f4f6", colors.ink)}>{r.from_template}</span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: colors.muted }}>{r.from_field}</span>
            <span style={{ fontSize: 18, color: colors.muted }}>→</span>
            <span style={pill("#fef9c3", "#92400e")}>{r.cardinality}</span>
            <span style={{ fontSize: 18, color: colors.muted }}>→</span>
            <span style={pill("#f3f4f6", colors.ink)}>{r.to_template}</span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: colors.muted }}>{r.to_field}</span>
            <span style={{ marginLeft: "auto", fontStyle: "italic", color: colors.muted, fontSize: 12 }}>{r.relationship_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
