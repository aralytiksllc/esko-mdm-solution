import { useState, useRef } from "react";
import { Modal } from "./Modal.jsx";
import { btn, colors, thStyle, tdStyle } from "../lib/styles.js";

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.filter(l => l.trim()).map(line => {
    const cols = []; let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

export function UploadModal({ template, onClose, onLoad }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      if (parsed.length < 2) return alert("File appears empty or invalid.");
      const headers = parsed[0];
      const rows = parsed.slice(1);
      const mapped = template.columns.map(c => {
        const idx = headers.findIndex(h => h.toLowerCase().trim() === c.name.toLowerCase().trim());
        return { col: c.name, fileIdx: idx };
      });
      const unmapped = mapped.filter(m => m.fileIdx === -1).map(m => m.col);
      setPreview({ fileName: file.name, headers, rows, mapped, unmapped });
    };
    reader.readAsText(file);
  }

  function confirm(mode) {
    const records = preview.rows.map(fileRow => {
      const payload = {};
      preview.mapped.forEach(m => {
        payload[m.col] = m.fileIdx >= 0 ? (fileRow[m.fileIdx] ?? "") : "";
      });
      return { business_key: payload[template.columns[0].name] ?? "", payload };
    });
    onLoad(records, mode, preview.fileName);
  }

  // Compute within-file duplicate keys for the preview banner
  const duplicates = (() => {
    if (!preview) return [];
    const counts = new Map();
    preview.rows.forEach(fileRow => {
      const m = preview.mapped[0];
      const k = m && m.fileIdx >= 0 ? (fileRow[m.fileIdx] ?? "").trim() : "";
      if (!k) return;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return [...counts.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ key: k, count: n }));
  })();
  const blanks = preview ? preview.rows.filter(fileRow => {
    const m = preview.mapped[0];
    return !(m && m.fileIdx >= 0 && (fileRow[m.fileIdx] ?? "").trim());
  }).length : 0;

  return (
    <Modal title={preview ? `Preview — ${preview.fileName}` : "Upload File"} onClose={onClose} width={760}>
      {!preview ? (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? colors.brand : "#d1d5db"}`,
              borderRadius: 14, padding: 48, textAlign: "center", cursor: "pointer",
              background: dragOver ? "#fff1f2" : "#fafbfc",
            }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your CSV file here</div>
            <div style={{ color: colors.muted, fontSize: 14 }}>or click to browse · .csv supported</div>
            <input ref={inputRef} type="file" accept=".csv,.tsv,.txt" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#f0f9ff", borderRadius: 10, fontSize: 13, color: "#1e40af" }}>
            File columns will be auto-mapped to <strong>{template.template_name}</strong>. You can review before loading.
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Column Mapping</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {preview.mapped.map(m => (
                <span key={m.col} style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500,
                  background: m.fileIdx >= 0 ? "#f0fdf4" : "#fef2f2",
                  color: m.fileIdx >= 0 ? "#166534" : "#dc2626",
                  border: `1px solid ${m.fileIdx >= 0 ? "#bbf7d0" : "#fecaca"}`,
                }}>{m.fileIdx >= 0 ? "✓" : "✗"} {m.col}</span>
              ))}
            </div>
            {preview.unmapped.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: colors.accentAmber }}>
                ⚠ {preview.unmapped.length} column(s) not found — will be empty: <strong>{preview.unmapped.join(", ")}</strong>
              </div>
            )}
          </div>

          <div style={{ border: "1px solid " + colors.line, borderRadius: 10, overflow: "auto", maxHeight: 240, marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8f9fb", position: "sticky", top: 0 }}>
                  {template.columns.map(c => <th key={c.name} style={{ ...thStyle, fontSize: 11 }}>{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((fileRow, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    {preview.mapped.map((m, ci) => (
                      <td key={ci} style={{ ...tdStyle, fontSize: 12, color: m.fileIdx < 0 ? "#9ca3af" : colors.ink }}>
                        {m.fileIdx >= 0 ? (fileRow[m.fileIdx] ?? "") : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(duplicates.length > 0 || blanks > 0) && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
              padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#991b1b",
            }}>
              {duplicates.length > 0 && (
                <div>
                  ⚠ <strong>{duplicates.length} duplicate key{duplicates.length > 1 ? "s" : ""} in this file</strong> —
                  for each, only the <strong>last occurrence</strong> will be kept (earlier copies are skipped).{" "}
                  Examples: {duplicates.slice(0, 5).map(d => `${d.key} (×${d.count})`).join(", ")}
                  {duplicates.length > 5 ? `, …` : ""}
                </div>
              )}
              {blanks > 0 && (
                <div style={{ marginTop: duplicates.length > 0 ? 4 : 0 }}>
                  ⚠ {blanks} row{blanks > 1 ? "s" : ""} with empty <code>{template.columns[0].name}</code> — will be skipped.
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>
            {preview.rows.length} rows detected{preview.rows.length > 8 ? ` · showing first 8` : ""}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", color: colors.muted, cursor: "pointer", fontSize: 13 }}>← Choose different file</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => confirm("append")} style={btn(colors.accentBlue)}>+ Append / Upsert</button>
              <button onClick={() => confirm("replace")} style={{ ...btn(colors.brand), fontWeight: 700 }}>↺ Replace All</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
