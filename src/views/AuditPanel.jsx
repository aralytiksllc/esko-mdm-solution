import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Modal } from "../components/Modal.jsx";
import { pill, colors } from "../lib/styles.js";

export function AuditPanel({ record, onClose }) {
  const [audit, setAudit] = useState([]);
  const [history, setHistory] = useState([]);
  const [xref, setXref] = useState([]);
  const [tab, setTab] = useState("audit");

  useEffect(() => {
    if (!record) return;
    Promise.all([
      api.auditForRecord(record.record_id),
      api.history(record.record_id),
      api.xrefForRecord(record.record_id),
    ]).then(([a, h, x]) => { setAudit(a); setHistory(h); setXref(x); });
  }, [record?.record_id]);

  if (!record) return null;

  return (
    <Modal title={`${record.business_key} — Record Inspector`} onClose={onClose} width={780}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["audit", "history", "xref"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: tab === t ? colors.brand : "#f3f4f6",
              color: tab === t ? "#fff" : colors.muted,
              border: "none", padding: "6px 14px", borderRadius: 6,
              cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>
            {t === "audit" ? `Audit (${audit.length})` : t === "history" ? `History (${history.length})` : `XREF (${xref.length})`}
          </button>
        ))}
      </div>

      {tab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {audit.length === 0 && <div style={{ color: colors.muted, padding: 20, textAlign: "center" }}>No audit entries.</div>}
          {audit.map(a => (
            <div key={a.audit_id} style={{
              padding: 12, border: "1px solid " + colors.line, borderRadius: 8,
              borderLeft: `3px solid ${a.action_type === "create" ? colors.accentGreen : a.action_type === "delete" ? colors.accentRed : colors.accentBlue}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{a.actor} <span style={{ color: colors.muted, fontSize: 11 }}>({a.actor_role})</span></span>
                <span style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>{new Date(a.action_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={pill("#eff6ff", "#2563eb")}>{a.action_type}</span>{" "}
                {a.field_name && <span style={{ fontFamily: "monospace", color: colors.muted }}>{a.field_name}</span>}
              </div>
              {a.field_name && (
                <div style={{ marginTop: 6, fontSize: 12, fontFamily: "monospace" }}>
                  <span style={{ background: "#fef2f2", padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>{a.old_value || "∅"}</span>
                  →
                  <span style={{ background: "#f0fdf4", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>{a.new_value || "∅"}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.length === 0 && <div style={{ color: colors.muted, padding: 20, textAlign: "center" }}>No prior versions.</div>}
          {history.map(h => (
            <div key={h.history_id} style={{ padding: 12, border: "1px solid " + colors.line, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={pill("#fef9c3", "#a16207")}>{h.change_type}</span>
                <span style={{ color: colors.muted, fontFamily: "monospace" }}>
                  {new Date(h.valid_from).toLocaleString()} → {new Date(h.valid_to).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: colors.muted, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(h.payload_json, null, 2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "xref" && (
        <div>
          {xref.length === 0 && <div style={{ color: colors.muted, padding: 20, textAlign: "center" }}>No source-system mappings.</div>}
          {xref.map(x => (
            <div key={x.xref_id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 0", borderBottom: "1px solid " + colors.line,
            }}>
              <span style={pill("#eff6ff", "#2563eb")}>{x.source_system}</span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{x.source_key}</span>
              <span style={{ color: colors.muted }}>→</span>
              <span style={{ flex: 1 }}>{x.source_value}</span>
              <span style={{ fontSize: 11, color: colors.muted }}>{x.is_active ? "active" : "inactive"}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
