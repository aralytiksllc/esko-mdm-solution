import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, pill, thStyle, tdStyle, colors } from "../lib/styles.js";
import { Modal } from "../components/Modal.jsx";

export function Glossary({ templates, currentUser, notify }) {
  const [terms, setTerms] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // term object | "new"
  const [form, setForm] = useState({});

  useEffect(() => { reload(); }, []);
  function reload() { api.glossary().then(setTerms).catch(e => notify(e.message, "error")); }

  function openNew() {
    setEditing("new");
    setForm({ term_name: "", definition: "", category: "", owner: "", steward: currentUser?.user_name ?? "", related_template: "", related_field: "" });
  }
  function openEdit(t) {
    setEditing(t);
    setForm({ ...t });
  }

  async function save() {
    try {
      if (editing === "new") await api.createTerm(form);
      else await api.updateTerm(editing.term_id, form);
      setEditing(null);
      reload();
      notify("Glossary saved", "success");
    } catch (e) { notify(e.message, "error"); }
  }

  async function remove(id) {
    if (!confirm("Delete term?")) return;
    try { await api.deleteTerm(id); reload(); notify("Deleted", "info"); }
    catch (e) { notify(e.message, "error"); }
  }

  const filtered = terms.filter(t =>
    !search || t.term_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.definition ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const cats = Array.from(new Set(terms.map(t => t.category).filter(Boolean)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Business Glossary</h1>
          <p style={{ color: colors.muted, margin: "4px 0 0", fontSize: 14 }}>
            Definitions, ownership, and links between business terms and master data fields.
          </p>
        </div>
        <button style={btn(colors.brand)} onClick={openNew}>+ New Term</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search terms…"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
      </div>

      {/* Category strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {cats.map(c => (
          <span key={c} style={pill("#eff6ff", "#2563eb")}>{c} ({terms.filter(t => t.category === c).length})</span>
        ))}
      </div>

      <div style={{ ...card, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fb" }}>
              {["Term", "Definition", "Category", "Owner", "Steward", "Linked Field", ""].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={t.term_id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", cursor: "pointer" }}
                onClick={() => openEdit(t)}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{t.term_name}</td>
                <td style={{ ...tdStyle, whiteSpace: "normal", maxWidth: 420 }}>{t.definition}</td>
                <td style={tdStyle}>{t.category}</td>
                <td style={tdStyle}>{t.owner}</td>
                <td style={tdStyle}>{t.steward}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>
                  {t.related_template && t.related_field ? `${t.related_template}.${t.related_field}` : "—"}
                </td>
                <td style={tdStyle}>
                  <button onClick={e => { e.stopPropagation(); remove(t.term_id); }}
                    style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
                             padding: "3px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === "new" ? "New Term" : "Edit Term"} onClose={() => setEditing(null)} width={620}>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              ["term_name", "Term Name"],
              ["definition", "Definition", "textarea"],
              ["category", "Category"],
              ["owner", "Owner"],
              ["steward", "Steward"],
            ].map(([k, label, type]) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>{label}</label>
                {type === "textarea" ? (
                  <textarea value={form[k] ?? ""} onChange={e => setForm({ ...form, [k]: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, minHeight: 80, boxSizing: "border-box" }} />
                ) : (
                  <input value={form[k] ?? ""} onChange={e => setForm({ ...form, [k]: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                )}
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>Linked Entity</label>
                <select value={form.related_template ?? ""} onChange={e => setForm({ ...form, related_template: e.target.value })}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
                  <option value="">— none —</option>
                  {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.template_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>Linked Field</label>
                <select value={form.related_field ?? ""} onChange={e => setForm({ ...form, related_field: e.target.value })}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
                  <option value="">— none —</option>
                  {(templates.find(t => t.template_key === form.related_template)?.columns ?? []).map(c =>
                    <option key={c.name} value={c.name}>{c.name}</option>
                  )}
                </select>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button style={btn("#6b7280")} onClick={() => setEditing(null)}>Cancel</button>
            <button style={btn(colors.brand)} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
