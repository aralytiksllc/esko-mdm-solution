import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, pill, dqColor, colors } from "../lib/styles.js";
import { Modal } from "../components/Modal.jsx";
import { DDLPreviewModal } from "../components/DDLPreviewModal.jsx";

const BLANK_COL = { name: "", type: "text", required: false, isKey: false, options: "" };

export function Dashboard({ templates, currentUser, openTemplate, setActiveView, notify, reloadTemplates, reloadProvisioning }) {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [matches, setMatches] = useState([]);
  const [dq, setDq] = useState([]);
  const [pendingByTmpl, setPendingByTmpl] = useState({}); // { template_key: { sql: n, lakehouse: n } }
  const [ddlPreviewIds, setDdlPreviewIds] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // template object or null
  const [deletingKey, setDeletingKey] = useState(null);
  const [wizMode, setWizMode] = useState("scratch"); // "scratch" | "clone"
  const [wiz, setWiz] = useState({
    template_key: "", template_name: "", icon: "📋",
    phase: "Phase 3", approval_chain: "Data Steward",
    sql_table: "", bronze_table: "",
    clone_from: "", columns: [{ ...BLANK_COL, isKey: true, required: true }],
  });
  const [creating, setCreating] = useState(false);

  function resetWizard() {
    setWizMode("scratch");
    setWiz({
      template_key: "", template_name: "", icon: "📋",
      phase: "Phase 3", approval_chain: "Data Steward",
      sql_table: "", bronze_table: "",
      clone_from: "", columns: [{ ...BLANK_COL, isKey: true, required: true }],
    });
  }

  async function createEntity() {
    if (!wiz.template_name.trim()) return notify("Entity name is required", "error");
    if (!wiz.template_key.trim()) return notify("Entity key is required", "error");
    if (wizMode === "scratch" && wiz.columns.filter(c => c.name.trim()).length === 0) {
      return notify("At least one column is required", "error");
    }
    if (wizMode === "clone" && !wiz.clone_from) {
      return notify("Pick an entity to clone from", "error");
    }
    setCreating(true);
    try {
      const body = {
        template_key: wiz.template_key.trim(),
        template_name: wiz.template_name.trim(),
        icon: wiz.icon || "📋",
        phase: wiz.phase, approval_chain: wiz.approval_chain,
        sql_table: wiz.sql_table.trim() || undefined,
        bronze_table: wiz.bronze_table.trim() || undefined,
      };
      if (wizMode === "clone") {
        body.clone_from = wiz.clone_from;
      } else {
        body.columns = wiz.columns
          .filter(c => c.name.trim())
          .map(c => ({
            name: c.name.trim(), type: c.type,
            required: !!c.required, isKey: !!c.isKey,
            options: c.type === "select"
              ? String(c.options || "").split(",").map(s => s.trim()).filter(Boolean)
              : [],
          }));
      }
      const r = await api.createTemplate(body);
      notify(`✓ Entity "${r.template_key}" created — DDL pending deployment`, "success");
      setShowWizard(false);
      resetWizard();
      await reloadTemplates();
      reloadProvisioning?.();
      if (r?.provisioning) setDdlPreviewIds(r.provisioning);
    } catch (e) { notify(e.message, "error"); }
    finally { setCreating(false); }
  }

  async function deleteEntity() {
    if (!confirmDelete) return;
    const t = confirmDelete;
    setDeletingKey(t.template_key);
    try {
      const r = await api.deleteTemplate(t.template_key);
      notify(`✓ Entity "${t.template_key}" removed — DROP TABLE DDL queued`, "success");
      setConfirmDelete(null);
      await reloadTemplates();
      reloadProvisioning?.();
      if (r?.provisioning) setDdlPreviewIds(r.provisioning);
    } catch (e) { notify(e.message, "error"); }
    finally { setDeletingKey(null); }
  }

  function updateCol(idx, patch) {
    setWiz(s => ({ ...s, columns: s.columns.map((c, i) => i === idx ? { ...c, ...patch } : c) }));
  }
  function addCol() {
    setWiz(s => ({ ...s, columns: [...s.columns, { ...BLANK_COL }] }));
  }
  function removeCol(idx) {
    setWiz(s => ({ ...s, columns: s.columns.filter((_, i) => i !== idx) }));
  }

  useEffect(() => {
    Promise.all([
      api.dqOverview(),
      api.tasks({ status: "open" }),
      api.matchGroups("pending"),
      api.provisioningPendingSummary().catch(() => []),
    ]).then(([dqOv, ts, mg, pendSum]) => {
      setDq(dqOv);
      setTasks(ts);
      setMatches(mg);
      const grouped = {};
      for (const p of pendSum ?? []) {
        const k = p.template_key;
        grouped[k] = grouped[k] ?? { sql: 0, lakehouse: 0 };
        grouped[k][p.target] = Number(p.cnt ?? 0);
      }
      setPendingByTmpl(grouped);
      setStats({
        templates: templates.length,
        records: templates.reduce((a, t) => a + (t.row_count ?? 0), 0),
        avgDq: Math.round(dqOv.reduce((a, d) => a + (d.overall ?? 0), 0) / Math.max(dqOv.length, 1)),
        openTasks: ts.length,
      });
    }).catch(e => notify(e.message, "error"));
  }, [templates]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>Master Data Dashboard</h1>
        <p style={{ color: colors.muted, margin: "6px 0 0", fontSize: 14 }}>
          Logged in as <strong>{currentUser?.user_name}</strong> ({currentUser?.role_name}) · Microsoft Entra ID SSO
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Entities",      value: stats?.templates ?? "—", color: colors.accentBlue },
          { label: "Golden Records", value: stats?.records ?? "—",   color: colors.accentGreen },
          { label: "Avg DQ Score",  value: stats ? stats.avgDq + "%" : "—", color: dqColor(stats?.avgDq) },
          { label: "Open Tasks",    value: stats?.openTasks ?? "—",  color: colors.accentAmber },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: "18px 22px" }}>
            <div style={{ fontSize: 12, color: colors.muted, fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Action strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Pending Match Reviews</h3>
            <button style={btn(colors.accentBlue, { fontSize: 11 })} onClick={() => setActiveView("match")}>Open →</button>
          </div>
          {matches.length === 0 ? <div style={{ color: colors.muted, fontSize: 13 }}>No pending matches</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {matches.slice(0, 3).map(m => (
                <div key={m.match_group_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 13 }}>{m.template_key} · {m.rule_name}</span>
                  <span style={pill("#fffbeb", "#d97706")}>{m.match_score}% confidence</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Stewardship Inbox</h3>
            <button style={btn(colors.accentAmber, { fontSize: 11 })} onClick={() => setActiveView("stewardship")}>Open →</button>
          </div>
          {tasks.length === 0 ? <div style={{ color: colors.muted, fontSize: 13 }}>No open tasks</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tasks.slice(0, 3).map(t => (
                <div key={t.task_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 13 }}>{t.title}</span>
                  <span style={pill(t.priority === "high" ? "#fef2f2" : "#eff6ff", t.priority === "high" ? "#dc2626" : "#2563eb")}>{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Templates */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Master Data Entities</h2>
        {currentUser?.role_name === "Admin" && (
          <button onClick={() => { resetWizard(); setShowWizard(true); }} style={btn("#7c3aed", { fontSize: 12, fontWeight: 600 })}>
            + New Entity
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {templates.map(t => {
          const ov = dq.find(d => d.template_key === t.template_key);
          const pend = pendingByTmpl[t.template_key];
          const totalPend = (pend?.sql ?? 0) + (pend?.lakehouse ?? 0);
          return (
            <div key={t.template_key} onClick={() => openTemplate(t.template_key)}
              style={{
                ...card, padding: 22, cursor: "pointer", transition: "transform .12s",
                borderLeft: totalPend > 0 ? "3px solid #7c3aed" : undefined,
                position: "relative",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>

              {(t.permissions?.admin ?? currentUser?.role_name === "Admin") && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }}
                  title={`Delete entity "${t.template_name}"`}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    background: "transparent", border: "none", cursor: "pointer",
                    color: colors.muted, fontSize: 14, padding: 4, borderRadius: 6,
                    opacity: 0.4, transition: "all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = colors.muted; }}
                >🗑</button>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 26 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t.template_name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>{t.row_count ?? "—"} records · {t.columns?.length ?? 0} fields</div>
                  {totalPend > 0 && (
                    <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, marginTop: 2 }}>
                      🛠 {totalPend} schema change{totalPend > 1 ? "s" : ""} pending
                    </div>
                  )}
                </div>
                {ov && (
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    border: `3px solid ${dqColor(ov.overall)}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 12, color: dqColor(ov.overall),
                  }}>{Math.round(ov.overall)}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {t.columns?.slice(0, 3).map(c => (
                  <span key={c.name} style={{ fontSize: 11, background: "#f3f4f6", color: colors.muted, padding: "3px 9px", borderRadius: 20 }}>{c.name}</span>
                ))}
                {(t.columns?.length ?? 0) > 3 && <span style={{ fontSize: 11, color: "#9ca3af" }}>+{t.columns.length - 3}</span>}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{t.sql_table}</div>
            </div>
          );
        })}
      </div>

      {ddlPreviewIds && (
        <DDLPreviewModal
          provIds={ddlPreviewIds}
          currentUser={currentUser}
          notify={notify}
          onClose={() => { setDdlPreviewIds(null); reloadProvisioning?.(); reloadTemplates?.(); }}
        />
      )}

      {confirmDelete && (
        <Modal title={`Delete entity: ${confirmDelete.template_name}`} onClose={() => setConfirmDelete(null)}>
          <div style={{ fontSize: 13 }}>
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
              padding: "12px 14px", marginBottom: 14, color: "#991b1b",
            }}>
              <strong>This will retire all data for this entity.</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: 12 }}>
                <li>{confirmDelete.row_count ?? "?"} golden record(s) deleted from <code>mds_golden_record</code></li>
                <li>SCD2 history, audit log, publish log all cleared</li>
                <li>Template metadata removed from <code>mds_template</code> + <code>mds_template_column</code></li>
                <li><strong>DROP TABLE DDL is queued</strong> for both targets — your DBA must apply it to physically drop <code>{confirmDelete.sql_table}</code> and <code>{confirmDelete.bronze_table}</code></li>
              </ul>
            </div>

            <div style={{ background: "#f8f9fb", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12 }}>
              <table style={{ width: "100%" }}>
                <tbody>
                  {[
                    ["Entity key", confirmDelete.template_key],
                    ["SQL target", confirmDelete.sql_table],
                    ["Bronze target", confirmDelete.bronze_table],
                    ["Phase", confirmDelete.phase ?? "—"],
                    ["Approval chain", confirmDelete.approval_chain ?? "—"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: "3px 0", color: colors.muted, fontWeight: 500 }}>{k}</td>
                      <td style={{ padding: "3px 0", fontFamily: "monospace", textAlign: "right" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 12, color: colors.muted, margin: "0 0 14px" }}>
              This action <strong>cannot be undone</strong> via the app. The DROP TABLE DDL will appear in the Provisioning queue
              and remain pending until your DBA executes and acknowledges it.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={btn("#6b7280")} disabled={!!deletingKey}>Cancel</button>
              <button onClick={deleteEntity} disabled={!!deletingKey}
                style={btn("#dc2626", { fontWeight: 700 })}>
                {deletingKey ? "Deleting…" : "🗑 Delete entity & queue DROP TABLE"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showWizard && (
        <Modal title="Create new entity" onClose={() => setShowWizard(false)}>
          <div style={{ display: "grid", gap: 14, fontSize: 13, maxHeight: "70vh", overflow: "auto", paddingRight: 4 }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { k: "scratch", label: "From scratch" },
                { k: "clone", label: "Clone existing" },
              ].map(m => (
                <button key={m.k} onClick={() => setWizMode(m.k)}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8,
                    border: `1px solid ${wizMode === m.k ? "#7c3aed" : "#d1d5db"}`,
                    background: wizMode === m.k ? "#f5f3ff" : "#fff",
                    color: wizMode === m.k ? "#7c3aed" : colors.muted,
                    cursor: "pointer", fontWeight: 600, fontSize: 13,
                  }}>{m.label}</button>
              ))}
            </div>

            {/* Common fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Display name *</div>
                <input value={wiz.template_name}
                  onChange={e => setWiz(s => ({
                    ...s,
                    template_name: e.target.value,
                    template_key: s.template_key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
                  }))}
                  placeholder="e.g. Country Groups"
                  style={inputStyle} />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Key (slug) *</div>
                <input value={wiz.template_key}
                  onChange={e => setWiz(s => ({ ...s, template_key: e.target.value }))}
                  placeholder="e.g. country_groups"
                  style={{ ...inputStyle, fontFamily: "monospace" }} />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Icon</div>
                <input value={wiz.icon} onChange={e => setWiz(s => ({ ...s, icon: e.target.value }))}
                  style={inputStyle} maxLength={4} />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Phase</div>
                <select value={wiz.phase} onChange={e => setWiz(s => ({ ...s, phase: e.target.value }))}
                  style={{ ...inputStyle, background: "#fff" }}>
                  <option>MVP</option><option>Phase 2</option><option>Phase 3</option>
                </select>
              </label>
              <label style={{ gridColumn: "span 2" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Approval chain</div>
                <input value={wiz.approval_chain}
                  onChange={e => setWiz(s => ({ ...s, approval_chain: e.target.value }))}
                  placeholder="e.g. Data Steward → BI Lead"
                  style={inputStyle} />
              </label>
            </div>

            {/* Mode-specific */}
            {wizMode === "clone" ? (
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Clone from *</div>
                <select value={wiz.clone_from} onChange={e => setWiz(s => ({ ...s, clone_from: e.target.value }))}
                  style={{ ...inputStyle, background: "#fff" }}>
                  <option value="">— pick an existing entity —</option>
                  {templates.map(t => (
                    <option key={t.template_key} value={t.template_key}>
                      {t.icon} {t.template_name} ({t.columns?.length ?? 0} cols)
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
                  Columns and metadata are copied from the source. You can edit columns in the grid afterwards.
                </p>
              </label>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Columns *</div>
                  <button onClick={addCol} style={btn("#6b7280", { fontSize: 11, padding: "4px 10px" })}>+ Column</button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {wiz.columns.map((c, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 24px", gap: 6, alignItems: "center" }}>
                      <input value={c.name} onChange={e => updateCol(i, { name: e.target.value })}
                        placeholder={i === 0 ? "Key field name" : "Column name"} style={inputStyle} />
                      <select value={c.type} onChange={e => updateCol(i, { type: e.target.value })}
                        style={{ ...inputStyle, background: "#fff" }}>
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="date">date</option>
                        <option value="select">select</option>
                      </select>
                      <input value={c.options} onChange={e => updateCol(i, { options: e.target.value })}
                        placeholder={c.type === "select" ? "comma-separated" : ""}
                        disabled={c.type !== "select"}
                        style={{ ...inputStyle, opacity: c.type === "select" ? 1 : 0.4 }} />
                      <label style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                        <input type="checkbox" checked={!!c.required} onChange={e => updateCol(i, { required: e.target.checked })} />
                        req
                      </label>
                      <label style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                        <input type="checkbox" checked={!!c.isKey}
                          onChange={e => setWiz(s => ({
                            ...s,
                            columns: s.columns.map((cc, idx) => ({ ...cc, isKey: idx === i ? e.target.checked : false })),
                          }))} />
                        key
                      </label>
                      <button onClick={() => removeCol(i)} disabled={wiz.columns.length === 1}
                        style={{ background: "transparent", border: "none", cursor: wiz.columns.length === 1 ? "not-allowed" : "pointer", color: colors.muted, fontSize: 16, opacity: wiz.columns.length === 1 ? 0.3 : 1 }}>×</button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>
                  Mark exactly one column as <strong>key</strong> — it becomes the unique business identifier.
                </p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4, borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => setShowWizard(false)} style={btn("#6b7280")} disabled={creating}>Cancel</button>
              <button onClick={createEntity} style={btn("#7c3aed", { fontWeight: 700 })} disabled={creating}>
                {creating ? "Creating…" : "✨ Create entity"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box", outline: "none",
};
