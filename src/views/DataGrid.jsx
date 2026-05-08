import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "../lib/api.js";
import { thStyle, tdStyle, btn, card, pill, colors, dqColor } from "../lib/styles.js";
import { UploadModal } from "../components/UploadModal.jsx";
import { Modal } from "../components/Modal.jsx";
import { DDLPreviewModal } from "../components/DDLPreviewModal.jsx";

// ── Period Lock helper (VL-08) ──
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function computeLockedColumns(tmpl, today = new Date()) {
  const lockDay = tmpl?.period_lock_day;
  if (!lockDay) return new Set();
  const locked = new Set();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  (tmpl.columns ?? []).forEach((c) => {
    const monthIdx = MONTHS_SHORT.indexOf(c.name);
    if (monthIdx === -1) return;
    if (currentMonth > monthIdx + 1) locked.add(c.name);
    else if (currentMonth === monthIdx + 1 && currentDay > lockDay) locked.add(c.name);
  });
  return locked;
}

// ── Single-cell validator (VL-01) ──
function validateCell(c, v) {
  if (c.required && (v == null || String(v).trim() === "")) return `${c.name} is required`;
  if (c.type === "number" && v && isNaN(Number(v))) return `${c.name} must be numeric`;
  if (c.type === "select" && v && c.options?.length && !c.options.includes(v))
    return `${c.name}: "${v}" not in allowed options`;
  return null;
}

export function DataGrid({ template, currentUser, notify, openAuditFor, reloadTemplates, reloadProvisioning, setActiveView }) {
  const [records, setRecords] = useState([]);
  const [editedCells, setEditedCells] = useState({});
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [validation, setValidation] = useState([]);
  const [showValidation, setShowValidation] = useState(false);
  const [publishStatus, setPublishStatus] = useState({ sql: null, lakehouse: null });
  const [showLakehouseConfirm, setShowLakehouseConfirm] = useState(false);
  const [busy, setBusy] = useState(null); // "sql" | "lakehouse" | null
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newCol, setNewCol] = useState({ name: "", type: "text", required: false, options: "" });
  const [ddlPreviewIds, setDdlPreviewIds] = useState(null); // { sql, lakehouse } | null
  const [pendingByTarget, setPendingByTarget] = useState({ sql: 0, lakehouse: 0 });

  // ── Bulk ops (DE-05) ──
  const [selected, setSelected] = useState(new Set()); // record_ids
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState({ field: "", value: "" });

  // ── Bulk period copy (DE-07) ──
  const [showPeriodCopy, setShowPeriodCopy] = useState(false);
  const [periodCopy, setPeriodCopy] = useState({ source: "", target: "", action: "copy" });

  // ── Cell-level errors (VL-01) ──
  const [cellErrors, setCellErrors] = useState({}); // `${recordId}|${field}` -> msg

  // ── Concurrency lock (SC-03) ──
  const [lockHolder, setLockHolder] = useState(null); // { locked_by, locked_by_name, expires_at } or null
  const [iHoldLock, setIHoldLock] = useState(false);
  const heartbeatRef = useRef(null);

  // ── Approval (AW-01/02) ──
  const [approval, setApproval] = useState({ pending: null, lastApproved: null });

  async function refreshApproval() {
    if (!template?.requires_approval) { setApproval({ pending: null, lastApproved: null }); return; }
    try {
      const all = await api.workflowRequests();
      const forTmpl = all.filter(r => r.template_key === template.template_key);
      const pending = forTmpl.find(r => r.status === "pending");
      const lastApproved = forTmpl.filter(r => r.status === "approved").sort((a,b)=> new Date(b.resolved_at)-new Date(a.resolved_at))[0];
      setApproval({ pending, lastApproved });
    } catch { /* ignore */ }
  }

  useEffect(() => { refreshApproval(); }, [template?.template_key, template?.requires_approval]);

  // Acquire/release/heartbeat lock when a template is open (SC-03)
  useEffect(() => {
    if (!template || !currentUser) return;
    let active = true;

    async function tryAcquire() {
      try {
        await api.acquireLock(template.template_key, {
          user: currentUser.user_id, name: currentUser.user_name ?? currentUser.user_id, ttl_seconds: 300,
        });
        if (!active) return;
        setLockHolder({ locked_by: currentUser.user_id, locked_by_name: currentUser.user_name ?? currentUser.user_id });
        setIHoldLock(true);
      } catch (e) {
        // 409 → someone else holds it; fetch holder for display
        try {
          const cur = await api.getLock(template.template_key);
          if (active) {
            setLockHolder(cur);
            setIHoldLock(false);
          }
        } catch { /* ignore */ }
      }
    }

    tryAcquire();
    heartbeatRef.current = setInterval(tryAcquire, 60_000);

    return () => {
      active = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // best-effort release (fire-and-forget; navigator.sendBeacon could be used for reliability)
      api.releaseLock(template.template_key, { user: currentUser.user_id }).catch(() => {});
      setLockHolder(null);
      setIHoldLock(false);
    };
  }, [template?.template_key, currentUser?.user_id]);

  const tableRef = useRef(null);

  // Locked columns (VL-08), recomputed when template metadata changes
  const lockedSet = useMemo(() => computeLockedColumns(template), [template]);

  async function refreshPendingForTemplate() {
    if (!template) return;
    try {
      const rows = await api.provisioning({ template_key: template.template_key, status: "pending" });
      const sql = rows.filter(r => r.target === "sql").length;
      const lakehouse = rows.filter(r => r.target === "lakehouse").length;
      setPendingByTarget({ sql, lakehouse });
    } catch { /* ignore */ }
  }

  useEffect(() => { refreshPendingForTemplate(); }, [template?.template_key]);

  useEffect(() => {
    if (!template) return;
    reload();
    refreshPublish();
  }, [template?.template_key]);

  async function reload() {
    try { setRecords(await api.records(template.template_key)); }
    catch (e) { notify(e.message, "error"); }
  }

  async function refreshPublish() {
    try {
      const { latest } = await api.publishStatus(template.template_key);
      const sql = latest.find(p => p.target === "sql");
      const lh = latest.find(p => p.target === "lakehouse");
      setPublishStatus({ sql, lakehouse: lh });
    } catch (e) { /* ignore */ }
  }

  if (!template) return <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>No entity selected.</div>;

  const columns = template.columns ?? [];
  const cols = columns.map(c => c.name);

  // Per-object permissions (SC-02) — fall back to role-based defaults when absent
  const role = currentUser?.role_name;
  const fallback = {
    view:    true,
    edit:    role === "Admin" || role === "Editor" || role === "Steward",
    submit:  role === "Admin" || role === "Editor" || role === "Steward",
    approve: role === "Admin" || role === "Steward",
    admin:   role === "Admin",
  };
  const perms = template.permissions ?? fallback;
  // Concurrency gate: edit/submit blocked when another user holds the lock
  const lockedByOther = !!lockHolder && !iHoldLock;
  const canEdit    = perms.edit    && !lockedByOther;
  const canSubmit  = perms.submit  && !lockedByOther;
  const canApprove = perms.approve;
  const canAdmin   = perms.admin   && !lockedByOther;

  function getValue(rec, field) {
    const eAll = editedCells[rec.record_id] ?? {};
    if (field in eAll) return eAll[field];
    return rec.payload_json?.[field] ?? "";
  }

  function setValue(rec, field, val) {
    if (!canEdit) return notify(`No edit permission on this entity for role "${role}"`, "error");
    if (lockedSet.has(field)) return notify(`${field} is locked (period closed)`, "error");
    setEditedCells(prev => ({ ...prev, [rec.record_id]: { ...(prev[rec.record_id] ?? {}), [field]: val } }));

    // On-change validation (VL-01)
    const colDef = columns.find(c => c.name === field);
    if (colDef) {
      const err = validateCell(colDef, val);
      const k = `${rec.record_id}|${field}`;
      setCellErrors(prev => {
        const next = { ...prev };
        if (err) next[k] = err; else delete next[k];
        return next;
      });
    }
  }

  // ── Clipboard paste from Excel (DE-04) ──
  async function handlePaste(e) {
    if (!canEdit) return;
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!text.trim()) return;
    // Only intercept when it looks like a tabular paste (has tabs or newlines)
    if (!/\t/.test(text) && !/\n/.test(text)) return;
    e.preventDefault();
    const rows = text.replace(/\r\n/g, "\n").split("\n").filter(r => r.trim()).map(r => r.split("\t"));
    if (!rows.length) return;
    // Map onto template columns; first col is business_key
    const payloads = rows.map(r => {
      const p = {};
      columns.forEach((c, ci) => { p[c.name] = (r[ci] ?? "").trim(); });
      return { business_key: p[columns[0]?.name] ?? "", payload: p };
    }).filter(x => x.business_key);
    if (!payloads.length) {
      notify("Paste skipped — no business key in first column", "error");
      return;
    }
    // Pre-flight: warn on within-paste duplicate keys (last-wins semantics)
    const counts = new Map();
    payloads.forEach(p => counts.set(p.business_key, (counts.get(p.business_key) ?? 0) + 1));
    const dupes = [...counts.entries()].filter(([, n]) => n > 1);
    if (dupes.length) {
      const sample = dupes.slice(0, 3).map(([k, n]) => `${k}×${n}`).join(", ");
      const ok = confirm(
        `${dupes.length} duplicate key(s) in your paste (${sample}${dupes.length > 3 ? ", …" : ""}). ` +
        `Only the last occurrence of each will be kept. Continue?`
      );
      if (!ok) return;
    }
    try {
      const res = await api.bulkRecords(template.template_key, {
        rows: payloads, mode: "append", source_system: "Paste", user: currentUser.user_id,
      });
      const parts = [];
      if (res.added) parts.push(`${res.added} new`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.skipped) parts.push(`${res.skipped} unchanged`);
      notify(`📋 Paste: ${parts.join(" · ")}`, "success");
      reload();
    } catch (er) { notify(er.message, "error"); }
  }

  // ── Bulk delete selected rows (DE-05) ──
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Retire ${selected.size} record(s)? Records remain in history; only the current snapshot is removed.`)) return;
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await api.del(`/records/${id}`); ok++; } catch { fail++; }
    }
    notify(`Retired ${ok} record(s)${fail ? ` · ${fail} failed` : ""}`, fail ? "error" : "success");
    setSelected(new Set());
    reload();
  }

  // ── Bulk update one column on selected rows (DE-05) ──
  async function applyBulk() {
    if (!bulk.field) return notify("Pick a column", "error");
    if (lockedSet.has(bulk.field)) return notify(`${bulk.field} is locked`, "error");
    const ids = [...selected];
    if (!ids.length) return notify("No rows selected", "error");
    const colDef = columns.find(c => c.name === bulk.field);
    const err = colDef ? validateCell(colDef, bulk.value) : null;
    if (err) return notify(err, "error");
    let ok = 0, fail = 0;
    for (const id of ids) {
      const rec = records.find(r => r.record_id === id);
      if (!rec) { fail++; continue; }
      const oldV = rec.payload_json?.[bulk.field] ?? "";
      const newPayload = { ...rec.payload_json, [bulk.field]: bulk.value };
      try {
        await api.updateRecord(id, {
          payload: newPayload, user: currentUser.user_id,
          changed_fields: [{ field: bulk.field, old: oldV, new: bulk.value }],
        });
        ok++;
      } catch { fail++; }
    }
    notify(`✓ Updated ${bulk.field} on ${ok} row(s)${fail ? ` · ${fail} failed` : ""}`, fail ? "error" : "success");
    setShowBulk(false);
    setBulk({ field: "", value: "" });
    setSelected(new Set());
    reload();
  }

  // ── Bulk period copy (DE-07) ──
  async function applyPeriodCopy() {
    const { source, target, action } = periodCopy;
    if (!source || !target) return notify("Source and target periods required", "error");
    if (source === target) return notify("Source and target must differ", "error");
    if (lockedSet.has(target)) return notify(`Target "${target}" is locked`, "error");
    let ok = 0, fail = 0;
    for (const r of records) {
      const oldV = r.payload_json?.[target] ?? "";
      const newV = action === "copy" ? (r.payload_json?.[source] ?? "") : "";
      if (String(oldV) === String(newV)) continue;
      const newPayload = { ...r.payload_json, [target]: newV };
      try {
        await api.updateRecord(r.record_id, {
          payload: newPayload, user: currentUser.user_id,
          changed_fields: [{ field: target, old: oldV, new: newV }],
        });
        ok++;
      } catch { fail++; }
    }
    notify(`✓ ${action === "copy" ? "Copied" : "Cleared"} ${target}: ${ok} row(s) updated${fail ? ` · ${fail} failed` : ""}`, fail ? "error" : "success");
    setShowPeriodCopy(false);
    setPeriodCopy({ source: "", target: "", action: "copy" });
    reload();
  }

  async function saveRow(rec) {
    const changes = editedCells[rec.record_id];
    if (!changes) return;
    setSavingId(rec.record_id);
    const newPayload = { ...rec.payload_json, ...changes };
    const changed_fields = Object.entries(changes).map(([field, nv]) => ({
      field, old: rec.payload_json?.[field] ?? "", new: nv,
    }));
    try {
      await api.updateRecord(rec.record_id, { payload: newPayload, user: currentUser.user_id, changed_fields });
      setRecords(rs => rs.map(r => r.record_id === rec.record_id ? { ...r, payload_json: newPayload } : r));
      setEditedCells(prev => { const x = { ...prev }; delete x[rec.record_id]; return x; });
      notify(`Saved ${rec.business_key}`, "success");
    } catch (e) { notify(e.message, "error"); }
    finally { setSavingId(null); }
  }

  async function addRow() {
    const bk = prompt("New business key:");
    if (!bk) return;
    const empty = Object.fromEntries(cols.map(c => [c, c === cols[0] ? bk : ""]));
    try {
      const r = await api.createRecord(template.template_key, {
        business_key: bk, payload: empty, source_system: "Manual", user: currentUser.user_id,
      });
      setRecords(rs => [...rs, { record_id: r.record_id, template_key: template.template_key, business_key: bk, payload_json: empty, dq_score: null, source_system: "Manual" }]);
      notify(`Created ${bk}`, "success");
    } catch (e) { notify(e.message, "error"); }
  }

  // ── Validate ──
  function runValidate() {
    const errors = [];
    const seen = new Set();
    records.forEach((r, ri) => {
      const data = { ...r.payload_json, ...(editedCells[r.record_id] ?? {}) };
      // Unique business key
      if (r.business_key && seen.has(r.business_key)) {
        errors.push({ row: ri, key: r.business_key, msg: `Duplicate business key: "${r.business_key}"` });
      }
      seen.add(r.business_key);
      // Per-column rules
      columns.forEach(c => {
        const v = data[c.name];
        if (c.required && (v == null || String(v).trim() === "")) {
          errors.push({ row: ri, key: r.business_key, msg: `${c.name} is required` });
        }
        if (c.type === "number" && v && isNaN(Number(v))) {
          errors.push({ row: ri, key: r.business_key, msg: `${c.name} must be numeric (got "${v}")` });
        }
        if (c.type === "select" && v && c.options?.length && !c.options.includes(v)) {
          errors.push({ row: ri, key: r.business_key, msg: `${c.name}: "${v}" not in [${c.options.join(", ")}]` });
        }
      });
    });
    setValidation(errors);
    setShowValidation(true);
    if (errors.length === 0) notify("✓ All rows passed validation", "success");
    else notify(`${errors.length} validation error(s)`, "error");
  }

  // ── Submit for approval (AW-01) ──
  async function submitForApproval() {
    if (currentUser?.role_name === "Viewer") return notify("View-only access.", "error");
    const errs = quickValidate();
    if (errs > 0) { runValidate(); return notify(`${errs} validation error(s) — fix before requesting approval`, "error"); }
    try {
      const r = await api.createRequest({
        template_key: template.template_key,
        requested_by: currentUser.user_id,
        row_count: records.length,
        edited_count: Object.keys(editedCells).length,
        sql_table: template.sql_table,
        payload: { dirty_records: Object.keys(editedCells).length },
      });
      notify(`📝 Approval request created (${r.request_id}) — awaiting reviewer`, "success");
      refreshApproval();
    } catch (e) { notify(e.message, "error"); }
  }

  // ── Approve / reject pending request (AW-02) — Admin only ──
  async function actOnApproval(action, comment = null) {
    if (!approval.pending) return;
    if (currentUser?.role_name !== "Admin") return notify("Admin only", "error");
    try {
      await api.transitionRequest(approval.pending.request_id, {
        stage: action === "approved" ? "finance_approved" : "rejected",
        action, actor: currentUser.user_id, comment,
      });
      notify(action === "approved" ? "✓ Request approved — Submit to SQL is now unblocked" : "Request rejected", action === "approved" ? "success" : "info");
      refreshApproval();
    } catch (e) { notify(e.message, "error"); }
  }

  // ── Submit to local SQL ──
  async function submitSql() {
    if (currentUser?.role_name === "Viewer") return notify("View-only access — cannot submit.", "error");
    runValidate();
    // Allow user to proceed via modal even with errors? For demo, hard-block on errors:
    if (validation.length > 0) {
      // Re-run sync to be sure
      const errs = quickValidate();
      if (errs > 0) { notify(`${errs} validation error(s) — fix before submitting`, "error"); return; }
    } else {
      const errs = quickValidate();
      if (errs > 0) return;
    }
    setBusy("sql");
    try {
      const res = await api.publishSql(template.template_key, currentUser.user_id, currentUser.role_name);
      notify(`✓ ${res.row_count} rows submitted to ${res.sql_table}`, "success");
      refreshPublish();
    } catch (e) { notify(e.message, "error"); }
    finally { setBusy(null); }
  }

  function quickValidate() {
    let n = 0;
    const seen = new Set();
    records.forEach(r => {
      const data = { ...r.payload_json, ...(editedCells[r.record_id] ?? {}) };
      if (r.business_key && seen.has(r.business_key)) n++;
      seen.add(r.business_key);
      columns.forEach(c => {
        const v = data[c.name];
        if (c.required && (v == null || String(v).trim() === "")) n++;
        if (c.type === "number" && v && isNaN(Number(v))) n++;
      });
    });
    return n;
  }

  // ── Submit to Lakehouse ──
  async function submitLakehouse() {
    setBusy("lakehouse");
    try {
      const res = await api.publishLakehouse(template.template_key, currentUser.user_id, currentUser.role_name);
      notify(`🚀 ${res.row_count} rows → ${res.bronze_table} (Delta) ✓`, "success");
      setShowLakehouseConfirm(false);
      refreshPublish();
    } catch (e) {
      notify(e.message, "error");
      setShowLakehouseConfirm(false);
    } finally { setBusy(null); }
  }

  // After Submit-to-SQL succeeds, also refresh approval state (so the just-used approval shows as consumed)
  async function submitSqlWithRefresh() {
    await submitSql();
    refreshApproval();
  }

  // ── Schema: add / remove column ──
  async function addColumn() {
    if (!newCol.name.trim()) return notify("Column name is required", "error");
    try {
      const opts = newCol.type === "select"
        ? newCol.options.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      const r = await api.addColumn(template.template_key, {
        name: newCol.name.trim(), type: newCol.type, required: newCol.required, options: opts,
      });
      notify(`✓ Column "${newCol.name.trim()}" added — DDL pending deployment`, "success");
      setShowAddColumn(false);
      setNewCol({ name: "", type: "text", required: false, options: "" });
      await reloadTemplates();
      reloadProvisioning?.();
      refreshPendingForTemplate();
      if (r?.provisioning) setDdlPreviewIds(r.provisioning);
    } catch (e) { notify(e.message, "error"); }
  }

  async function removeColumn(name) {
    if (!confirm(`Remove column "${name}"? Existing data in this column will be hidden but kept in payload history.`)) return;
    try {
      const r = await api.removeColumn(template.template_key, name);
      notify(`✓ Column "${name}" removed — DROP COLUMN DDL pending deployment`, "success");
      await reloadTemplates();
      reloadProvisioning?.();
      refreshPendingForTemplate();
      if (r?.provisioning) setDdlPreviewIds(r.provisioning);
    } catch (e) { notify(e.message, "error"); }
  }

  // ── Upload ──
  async function handleUpload(rows, mode, fileName) {
    setShowUpload(false);
    try {
      const res = await api.bulkRecords(template.template_key, {
        rows, mode, source_system: `Upload: ${fileName}`, user: currentUser.user_id,
      });
      const parts = [];
      if (res.added) parts.push(`${res.added} new`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.skipped) parts.push(`${res.skipped} skipped`);
      if (res.retired) parts.push(`${res.retired} retired`);
      if (res.duplicates?.length) parts.push(`${res.duplicates.length} duplicate key(s) deduped`);
      notify(`📁 ${fileName}: ${parts.join(" · ")}`, res.duplicates?.length ? "info" : "success");
      reload();
      refreshPublish();
    } catch (e) { notify(e.message, "error"); }
  }

  const filtered = records.filter(r => !search ||
    JSON.stringify(r.payload_json ?? {}).toLowerCase().includes(search.toLowerCase()));

  const dirtyCount = Object.keys(editedCells).length;
  const sqlPub = publishStatus.sql;
  const lhPub = publishStatus.lakehouse;
  const sqlBehind = sqlPub && lhPub ? new Date(sqlPub.submitted_at) > new Date(lhPub.submitted_at) : !!sqlPub;
  const canSubmitLakehouse = !!sqlPub && (sqlBehind || !lhPub);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>{template.icon}</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{template.template_name}</h1>
          <span style={pill(
            currentUser?.role_name === "Admin" ? "#dcfce7" : currentUser?.role_name === "Editor" ? "#dbeafe" : "#f3f4f6",
            currentUser?.role_name === "Admin" ? "#166534" : currentUser?.role_name === "Editor" ? "#1e40af" : colors.muted,
          )}>{currentUser?.role_name}</span>
          <span style={{ fontSize: 12, color: colors.muted, fontFamily: "monospace" }}>{template.sql_table}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, width: 200 }} />
        {canEdit && <button style={btn(colors.accentBlue)} onClick={() => setShowUpload(true)}>📁 Upload File</button>}
        {canEdit && <button style={btn(colors.accentGreen)} onClick={addRow}>+ Add Record</button>}
        {canAdmin && (
          <button style={btn("#7c3aed")} onClick={() => setShowAddColumn(true)}>+ Column</button>
        )}
        {template.supports_period_copy && canEdit && (
          <button style={btn("#7c3aed")} onClick={() => setShowPeriodCopy(true)} title="Copy values between periods (months)">
            📅 Bulk Period Copy
          </button>
        )}
        <button style={btn(colors.accentAmber)} onClick={runValidate}>✓ Validate</button>

        {selected.size > 0 && canEdit && (
          <>
            <span style={{ ...pill("#fef3c7", "#92400e"), fontSize: 12 }}>{selected.size} selected</span>
            <button style={btn("#0ea5e9", { fontSize: 12 })} onClick={() => setShowBulk(true)}>✏ Bulk update</button>
            <button style={btn("#dc2626", { fontSize: 12 })} onClick={deleteSelected}>🗑 Retire selected</button>
            <button style={btn("#6b7280", { fontSize: 12 })} onClick={() => setSelected(new Set())}>Clear</button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Submit (SQL) — gated by approval if required */}
        {(() => {
          const needsApproval = !!template.requires_approval;
          const hasPendingReq = !!approval.pending;
          const hasFreshApproval = !!approval.lastApproved && (
            !sqlPub || new Date(approval.lastApproved.resolved_at) > new Date(sqlPub.submitted_at)
          );
          const blocked = !canSubmit;
          if (needsApproval && !hasFreshApproval) {
            return (
              <button onClick={submitForApproval}
                disabled={hasPendingReq || blocked}
                title={!canSubmit ? `Role "${role}" has no submit permission on this entity` : (hasPendingReq ? "Approval already pending" : "")}
                style={{
                  ...btn("#f59e0b", { fontWeight: 700, boxShadow: "0 2px 12px rgba(245,158,11,0.3)" }),
                  opacity: hasPendingReq || blocked ? 0.6 : 1,
                  cursor: hasPendingReq || blocked ? "not-allowed" : "pointer",
                }}>
                📝 {hasPendingReq ? "Approval pending" : "Submit for approval"}
              </button>
            );
          }
          return (
            <button onClick={submitSqlWithRefresh}
              disabled={busy === "sql" || blocked}
              title={!canSubmit ? `Role "${role}" has no submit permission on this entity` : ""}
              style={{
                ...btn(colors.brand, { fontWeight: 700, boxShadow: "0 2px 12px rgba(233,69,96,0.3)" }),
                opacity: busy === "sql" || blocked ? 0.6 : 1,
                cursor: blocked ? "not-allowed" : "pointer",
              }}>
              {busy === "sql" ? "..." : "💾 Submit to SQL"}
            </button>
          );
        })()}

        {/* Submit to Lakehouse */}
        <button onClick={() => setShowLakehouseConfirm(true)}
          disabled={!canSubmitLakehouse || busy === "lakehouse" || !canSubmit}
          style={{
            ...btn("linear-gradient(135deg, #1a1a2e, #0f3460)", { fontWeight: 700, boxShadow: "0 2px 12px rgba(15,52,96,0.3)" }),
            opacity: (!canSubmitLakehouse || !canSubmit) ? 0.45 : 1,
            cursor: (canSubmitLakehouse && canSubmit) ? "pointer" : "not-allowed",
          }}
          title={!canSubmit ? `Role "${role}" has no submit permission` : !sqlPub ? "Submit to SQL first" : (lhPub && !sqlBehind ? "Lakehouse already in sync" : "")}>
          🚀 Submit to Lakehouse
        </button>
      </div>

      {/* Pending provisioning banner */}
      {(pendingByTarget.sql > 0 || pendingByTarget.lakehouse > 0) && (
        <div style={{
          ...card, padding: "10px 16px", marginBottom: 12,
          borderLeft: "4px solid #7c3aed", background: "#f5f3ff",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 13, color: "#5b21b6" }}>
            <strong>Schema changes pending deployment:</strong>{" "}
            {pendingByTarget.sql > 0 && <>SQL Server ({pendingByTarget.sql})</>}
            {pendingByTarget.sql > 0 && pendingByTarget.lakehouse > 0 && " · "}
            {pendingByTarget.lakehouse > 0 && <>Lakehouse ({pendingByTarget.lakehouse})</>}
            {" "}— Submit is blocked for affected target until DDL is applied.
          </div>
          <button onClick={() => setActiveView?.("provisioning")}
            style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            title="Switch to Provisioning view">
            Open queue →
          </button>
        </div>
      )}

      {/* Status banner */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 12, flexWrap: "wrap" }}>
        <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, color: colors.muted }}>SQL Server:</span>
          {sqlPub ? (
            <>
              <span style={pill("#f0fdf4", "#16a34a")}>✓ {sqlPub.row_count} rows synced</span>
              <span style={{ color: colors.muted, fontFamily: "monospace", fontSize: 11 }}>
                {sqlPub.sql_table} · {new Date(sqlPub.submitted_at).toLocaleString()}
              </span>
            </>
          ) : <span style={pill("#f3f4f6", colors.muted)}>not yet submitted</span>}
        </div>
        <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, color: colors.muted }}>Lakehouse:</span>
          {lhPub && !sqlBehind ? (
            <>
              <span style={pill("#f0fdf4", "#16a34a")}>✓ Synced</span>
              <span style={{ color: colors.muted, fontFamily: "monospace", fontSize: 11 }}>
                {lhPub.bronze_table} · {new Date(lhPub.submitted_at).toLocaleString()}
              </span>
            </>
          ) : sqlPub ? (
            <span style={pill("#fffbeb", "#d97706")}>⏳ pending sync</span>
          ) : <span style={pill("#f3f4f6", colors.muted)}>—</span>}
        </div>
      </div>

      {/* Concurrency lock banner (SC-03) */}
      {lockedByOther && (
        <div style={{
          ...card, padding: "10px 16px", marginBottom: 12,
          borderLeft: "4px solid #dc2626", background: "#fef2f2",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 13, color: "#991b1b" }}>
            🔒 <strong>Currently being edited by {lockHolder.locked_by_name || lockHolder.locked_by}</strong>
            {lockHolder.expires_at && <> — auto-releases at {new Date(lockHolder.expires_at).toLocaleTimeString()}</>}
            . You're in read-only mode.
          </div>
        </div>
      )}
      {iHoldLock && (
        <div style={{ fontSize: 11, color: colors.muted, marginBottom: 8 }}>
          🔓 You hold the editing lock on this entity (auto-renews every 60 seconds).
        </div>
      )}

      {/* Approval banner (AW-01/02) */}
      {template.requires_approval && approval.pending && (
        <div style={{
          ...card, padding: "10px 16px", marginBottom: 12,
          borderLeft: "4px solid #f59e0b", background: "#fffbeb",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 13, color: "#92400e" }}>
            📝 <strong>Approval pending</strong> — request <code>{approval.pending.request_id}</code> by{" "}
            <strong>{approval.pending.requested_by}</strong> ·{" "}
            {approval.pending.row_count} row(s) · {approval.pending.edited_count} edits ·{" "}
            {new Date(approval.pending.requested_at).toLocaleString()}
          </div>
          {canApprove && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => actOnApproval("approved")} style={btn(colors.accentGreen, { fontSize: 11, fontWeight: 700 })}>✓ Approve</button>
              <button onClick={() => { const c = prompt("Reject reason (optional):") ?? null; actOnApproval("rejected", c); }}
                style={btn("#fef2f2", { fontSize: 11, color: "#dc2626" })}>✗ Reject</button>
            </div>
          )}
        </div>
      )}
      {template.requires_approval && !approval.pending && approval.lastApproved && (
        <div style={{
          ...card, padding: "8px 16px", marginBottom: 12,
          borderLeft: "4px solid #16a34a", background: "#f0fdf4", fontSize: 12, color: "#166534",
        }}>
          ✓ Last approval: <code>{approval.lastApproved.request_id}</code> by {approval.lastApproved.requested_by} ·{" "}
          {new Date(approval.lastApproved.resolved_at).toLocaleString()}
        </div>
      )}

      {/* Period lock banner (VL-08) */}
      {template.period_lock_day && lockedSet.size > 0 && (
        <div style={{
          ...card, padding: "10px 16px", marginBottom: 12,
          borderLeft: "4px solid #6b7280", background: "#f8f9fb", fontSize: 12,
        }}>
          🔒 <strong>Period lock active</strong> · past months are read-only after the {template.period_lock_day}
          {[1, 21, 31].includes(template.period_lock_day) ? "st" : [2, 22].includes(template.period_lock_day) ? "nd" : [3, 23].includes(template.period_lock_day) ? "rd" : "th"} business day of the following month.
          Locked: <strong>{[...lockedSet].join(", ")}</strong>.
        </div>
      )}

      {/* Validation banner */}
      {showValidation && (
        <div style={{
          ...card, padding: "10px 16px", marginBottom: 12,
          borderLeft: `4px solid ${validation.length === 0 ? colors.accentGreen : colors.accentRed}`,
          background: validation.length === 0 ? "#f0fdf4" : "#fef2f2",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: validation.length === 0 ? "#166534" : "#991b1b" }}>
              {validation.length === 0 ? "✓ All rows passed validation" : `${validation.length} validation error(s)`}
            </strong>
            <button onClick={() => setShowValidation(false)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.muted, fontSize: 18 }}>×</button>
          </div>
          {validation.length > 0 && (
            <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 12, color: "#991b1b", maxHeight: 120, overflow: "auto" }}>
              {validation.slice(0, 10).map((e, i) => <li key={i}><strong>{e.key}:</strong> {e.msg}</li>)}
              {validation.length > 10 && <li>…and {validation.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}

      {/* Grid */}
      <div ref={tableRef} onPaste={handlePaste} style={{ ...card, overflow: "auto", maxHeight: "62vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fb", position: "sticky", top: 0, zIndex: 1 }}>
              <th style={{ ...thStyle, width: 28 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(r => selected.has(r.record_id))}
                  onChange={e => setSelected(e.target.checked ? new Set(filtered.map(r => r.record_id)) : new Set())}
                />
              </th>
              <th style={thStyle}>#</th>
              <th style={thStyle}>DQ</th>
              {columns.map(c => {
                const locked = lockedSet.has(c.name);
                return (
                  <th key={c.name} style={{ ...thStyle, background: locked ? "#f3f4f6" : undefined }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {locked && <span title="Period locked — read-only" style={{ fontSize: 11 }}>🔒</span>}
                      {c.name}
                      {c.required && <span title="Required" style={{ color: "#dc2626", fontSize: 11 }}>*</span>}
                      {currentUser?.role_name === "Admin" && !c.isKey && (
                        <button
                          onClick={() => removeColumn(c.name)}
                          title={`Remove column "${c.name}"`}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: colors.muted, fontSize: 13, padding: 0, lineHeight: 1,
                            opacity: 0.5,
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
                        >×</button>
                      )}
                    </span>
                  </th>
                );
              })}
              <th style={thStyle}>Source</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const dirty = !!editedCells[r.record_id];
              const isSel = selected.has(r.record_id);
              return (
                <tr key={r.record_id} style={{ background: isSel ? "#eff6ff" : dirty ? "#fef9c3" : i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ ...tdStyle, width: 28 }}>
                    <input type="checkbox" checked={isSel}
                      onChange={e => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r.record_id); else next.delete(r.record_id);
                        setSelected(next);
                      }} />
                  </td>
                  <td style={{ ...tdStyle, color: "#9ca3af" }}>{i + 1}</td>
                  <td style={tdStyle}>
                    <span style={{ color: dqColor(r.dq_score), fontWeight: 700 }}>{r.dq_score ?? "—"}</span>
                  </td>
                  {columns.map(c => {
                    const val = getValue(r, c.name);
                    const isSelect = c.type === "select" && c.options?.length;
                    const locked = lockedSet.has(c.name);
                    const errKey = `${r.record_id}|${c.name}`;
                    const cellErr = cellErrors[errKey];
                    const readOnly = !canEdit || locked;
                    return (
                      <td key={c.name} title={cellErr || (locked ? "Period locked — read-only" : "")}
                        style={{
                          ...tdStyle,
                          background: cellErr ? "#fef2f2" : locked ? "#f9fafb" : undefined,
                          boxShadow: cellErr ? "inset 0 -2px 0 #dc2626" : undefined,
                        }}>
                        {isSelect ? (
                          <select value={val} onChange={e => setValue(r, c.name, e.target.value)}
                            disabled={readOnly}
                            style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, padding: "2px 0", outline: "none", color: cellErr ? "#dc2626" : undefined }}>
                            <option value="">—</option>
                            {c.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={c.type === "number" ? "text" : c.type} value={val}
                            onChange={e => setValue(r, c.name, e.target.value)}
                            readOnly={readOnly}
                            style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, padding: "2px 0", outline: "none",
                              fontFamily: c.type === "number" ? "monospace" : "inherit",
                              color: cellErr ? "#dc2626" : (locked ? colors.muted : undefined) }} />
                        )}
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, fontSize: 11, color: colors.muted }}>{r.source_system}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {dirty && (
                        <button onClick={() => saveRow(r)} disabled={savingId === r.record_id}
                          style={btn(colors.brand, { fontSize: 11, padding: "4px 10px" })}>
                          {savingId === r.record_id ? "..." : "Save"}
                        </button>
                      )}
                      <button onClick={() => openAuditFor(r)}
                        style={{ ...btn("#eff6ff", { fontSize: 11, padding: "4px 10px" }), color: "#2563eb" }}>
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: colors.muted }}>
        <div>{filtered.length} records · {dirtyCount} unsaved row(s)</div>
        <div style={{ fontFamily: "monospace" }}>→ {template.sql_table}</div>
      </div>

      {showUpload && (
        <UploadModal template={template} onClose={() => setShowUpload(false)} onLoad={handleUpload} />
      )}

      {ddlPreviewIds && (
        <DDLPreviewModal
          provIds={ddlPreviewIds}
          currentUser={currentUser}
          notify={notify}
          onClose={() => { setDdlPreviewIds(null); reloadProvisioning?.(); refreshPendingForTemplate(); }}
        />
      )}

      {showAddColumn && (
        <Modal title={`Add column to ${template.template_name}`} onClose={() => setShowAddColumn(false)}>
          <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Column name</div>
              <input value={newCol.name} onChange={e => setNewCol(s => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Region"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
            </label>
            <label>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Type</div>
              <select value={newCol.type} onChange={e => setNewCol(s => ({ ...s, type: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="date">date</option>
                <option value="select">select</option>
              </select>
            </label>
            {newCol.type === "select" && (
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Options (comma-separated)</div>
                <input value={newCol.options} onChange={e => setNewCol(s => ({ ...s, options: e.target.value }))}
                  placeholder="e.g. EMEA, Americas, APAC"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
              </label>
            )}
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={newCol.required} onChange={e => setNewCol(s => ({ ...s, required: e.target.checked }))} />
              <span>Required</span>
            </label>
            <p style={{ fontSize: 11, color: colors.muted, margin: "0" }}>
              Schema evolution — new column is added to <code>mds_template_column</code> and is immediately editable in the grid.
              Existing records have an empty value for this field until edited.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowAddColumn(false)} style={btn("#6b7280")}>Cancel</button>
              <button onClick={addColumn} style={btn("#7c3aed", { fontWeight: 700 })}>+ Add Column</button>
            </div>
          </div>
        </Modal>
      )}

      {showBulk && (
        <Modal title={`Bulk update on ${selected.size} row(s)`} onClose={() => setShowBulk(false)}>
          <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Column to update</div>
              <select value={bulk.field} onChange={e => setBulk(s => ({ ...s, field: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
                <option value="">—</option>
                {columns.filter(c => !c.isKey && !lockedSet.has(c.name)).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                ))}
              </select>
            </label>
            {bulk.field && (() => {
              const col = columns.find(c => c.name === bulk.field);
              if (col?.type === "select" && col.options?.length) {
                return (
                  <label>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>New value</div>
                    <select value={bulk.value} onChange={e => setBulk(s => ({ ...s, value: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
                      <option value="">—</option>
                      {col.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                );
              }
              return (
                <label>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>New value</div>
                  <input type={col?.type === "date" ? "date" : "text"}
                    value={bulk.value} onChange={e => setBulk(s => ({ ...s, value: e.target.value }))}
                    placeholder={col?.type === "number" ? "numeric" : ""}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                </label>
              );
            })()}
            <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>
              Each updated row writes a versioned snapshot to <code>mds_record_history</code> and a per-cell entry to <code>mds_audit_log</code>.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowBulk(false)} style={btn("#6b7280")}>Cancel</button>
              <button onClick={applyBulk} style={btn("#0ea5e9", { fontWeight: 700 })}>Apply to {selected.size} row(s)</button>
            </div>
          </div>
        </Modal>
      )}

      {showPeriodCopy && (
        <Modal title="Bulk Period Copy" onClose={() => setShowPeriodCopy(false)}>
          <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
            <p style={{ margin: 0, color: colors.muted }}>
              Copy values from one period column to another across all {records.length} record(s) — or clear a period.
              {lockedSet.size > 0 && <> Locked periods can't be a target.</>}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>From (source)</div>
                <select value={periodCopy.source} onChange={e => setPeriodCopy(s => ({ ...s, source: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
                  disabled={periodCopy.action === "clear"}>
                  <option value="">—</option>
                  {columns.filter(c => MONTHS_SHORT.includes(c.name)).map(c => (
                    <option key={c.name} value={c.name}>{c.name}{lockedSet.has(c.name) ? " 🔒" : ""}</option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>To (target)</div>
                <select value={periodCopy.target} onChange={e => setPeriodCopy(s => ({ ...s, target: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
                  <option value="">—</option>
                  {columns.filter(c => MONTHS_SHORT.includes(c.name) && !lockedSet.has(c.name)).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { k: "copy", label: "Copy values from source" },
                { k: "clear", label: "Clear target only" },
              ].map(o => (
                <button key={o.k} onClick={() => setPeriodCopy(s => ({ ...s, action: o.k }))}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${periodCopy.action === o.k ? "#7c3aed" : "#d1d5db"}`,
                    background: periodCopy.action === o.k ? "#f5f3ff" : "#fff",
                    color: periodCopy.action === o.k ? "#7c3aed" : colors.muted,
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowPeriodCopy(false)} style={btn("#6b7280")}>Cancel</button>
              <button onClick={applyPeriodCopy} style={btn("#7c3aed", { fontWeight: 700 })}>Apply</button>
            </div>
          </div>
        </Modal>
      )}

      {showLakehouseConfirm && (
        <Modal title="Submit to Lakehouse Bronze" onClose={() => setShowLakehouseConfirm(false)}>
          <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13 }}>
            <table style={{ width: "100%" }}>
              <tbody>
                {[
                  ["Entity", template.template_name],
                  ["Source", template.sql_table],
                  ["Bronze Target", template.bronze_table],
                  ["Format", "Delta Table (Parquet + Transaction Log)"],
                  ["Rows", records.length],
                  ["Medallion Path", "Bronze → Silver (SCD2) → Gold"],
                  ["Audit Cols", "modified_by, modified_at, batch_id, action_type"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "5px 0", color: colors.muted, fontWeight: 500 }}>{k}</td>
                    <td style={{ padding: "5px 0", fontWeight: 600, textAlign: "right" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: colors.muted, margin: "0 0 16px" }}>
            Records will be promoted to the Fabric Lakehouse Bronze layer as Delta tables; downstream pipelines move
            them through Silver (SCD2, dedup) and Gold (conformed).
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowLakehouseConfirm(false)} style={btn("#6b7280")}>Cancel</button>
            <button onClick={submitLakehouse} disabled={busy === "lakehouse"}
              style={{ ...btn("linear-gradient(135deg,#1a1a2e,#0f3460)"), fontWeight: 700, boxShadow: "0 2px 12px rgba(15,52,96,0.3)" }}>
              {busy === "lakehouse" ? "Submitting..." : "🚀 Confirm Submit"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
