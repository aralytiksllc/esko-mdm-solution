import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, pill, thStyle, tdStyle, priorityColor, colors } from "../lib/styles.js";

const TYPE_LABELS = {
  dq_fail: "DQ Failure",
  merge_candidate: "Merge Candidate",
  approval: "Approval",
  enrichment: "Enrichment",
  drift: "Drift",
};
const TYPE_COLORS = {
  dq_fail: { bg: "#fef2f2", color: "#dc2626" },
  merge_candidate: { bg: "#fef9c3", color: "#a16207" },
  approval: { bg: "#eff6ff", color: "#2563eb" },
  enrichment: { bg: "#f5f3ff", color: "#7c3aed" },
  drift: { bg: "#fff1f2", color: "#e11d48" },
};

export function Stewardship({ users, currentUser, notify, onTaskCountChange }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => { reload(); }, [filter]);

  function reload() {
    const params = filter === "all" ? {} : { status: filter };
    api.tasks(params).then(t => {
      setTasks(t);
      onTaskCountChange?.(t.filter(x => x.status === "open").length);
    }).catch(e => notify(e.message, "error"));
  }

  async function update(taskId, body) {
    try {
      await api.updateTask(taskId, { ...body, user: currentUser.user_id });
      reload();
      notify("Task updated", "success");
    } catch (e) { notify(e.message, "error"); }
  }

  const filtered = typeFilter === "all" ? tasks : tasks.filter(t => t.task_type === typeFilter);

  const summary = tasks.reduce((acc, t) => {
    acc[t.task_type] = (acc[t.task_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Stewardship Inbox</h1>
      <p style={{ color: colors.muted, margin: "0 0 20px", fontSize: 14 }}>
        Unified task queue — DQ failures, merge candidates, approvals, drift and enrichment requests.
      </p>

      {/* Type chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["all", ...Object.keys(TYPE_LABELS)].map(t => {
          const active = typeFilter === t;
          const cnt = t === "all" ? tasks.length : (summary[t] ?? 0);
          return (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{
                background: active ? colors.ink : "#fff",
                color: active ? "#fff" : colors.ink,
                border: "1px solid " + colors.line,
                borderRadius: 20, padding: "6px 14px", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
              }}>
              {t === "all" ? "All" : TYPE_LABELS[t]} <span style={{ opacity: 0.7 }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["open", "in_progress", "resolved", "all"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{
              background: filter === s ? colors.brand : "#f3f4f6",
              color: filter === s ? "#fff" : colors.muted,
              border: "none", padding: "5px 12px", borderRadius: 6,
              cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>{s}</button>
        ))}
      </div>

      <div style={{ ...card, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fb" }}>
              {["Type", "Priority", "Title", "Entity", "Assigned", "Status", "Actions"].map(h =>
                <th key={h} style={thStyle}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: colors.muted, padding: 24 }}>No tasks.</td></tr>
            )}
            {filtered.map((t, i) => {
              const tc = TYPE_COLORS[t.task_type] ?? { bg: "#f3f4f6", color: colors.muted };
              return (
                <tr key={t.task_id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={tdStyle}><span style={pill(tc.bg, tc.color)}>{TYPE_LABELS[t.task_type] ?? t.task_type}</span></td>
                  <td style={tdStyle}>
                    <span style={{ color: priorityColor(t.priority), fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>● {t.priority}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{t.detail}</div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{t.template_key ?? "—"}</td>
                  <td style={tdStyle}>
                    <select value={t.assigned_to ?? ""} onChange={e => update(t.task_id, { assigned_to: e.target.value })}
                      style={{ border: "1px solid " + colors.line, borderRadius: 6, padding: "3px 6px", fontSize: 12 }}>
                      <option value="">— unassigned —</option>
                      {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <span style={pill(
                      t.status === "open" ? "#fffbeb" : t.status === "in_progress" ? "#eff6ff" : "#f0fdf4",
                      t.status === "open" ? "#d97706" : t.status === "in_progress" ? "#2563eb" : "#16a34a",
                    )}>{t.status}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {t.status === "open" && (
                        <button onClick={() => update(t.task_id, { status: "in_progress" })}
                          style={btn(colors.accentBlue, { fontSize: 11, padding: "4px 8px" })}>Start</button>
                      )}
                      {t.status !== "resolved" && (
                        <button onClick={() => update(t.task_id, { status: "resolved" })}
                          style={btn(colors.accentGreen, { fontSize: 11, padding: "4px 8px" })}>Resolve</button>
                      )}
                      <button onClick={() => update(t.task_id, { status: "dismissed" })}
                        style={btn("#6b7280", { fontSize: 11, padding: "4px 8px" })}>Dismiss</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
