import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, pill, thStyle, tdStyle, colors } from "../lib/styles.js";

export function MatchMerge({ currentUser, notify }) {
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [merged, setMerged] = useState({});
  const [survivor, setSurvivor] = useState(null);

  useEffect(() => { reload(); }, []);
  function reload() {
    api.matchGroups().then(setGroups).catch(e => notify(e.message, "error"));
  }

  async function open(id) {
    setSelected(id);
    const d = await api.matchGroup(id);
    setDetails(d);
    const sur = d.candidates.find(c => c.is_surviving) ?? d.candidates[0];
    setSurvivor(sur.record_id);
    // Default merged = survivor's payload
    setMerged({ ...sur.payload_json });
  }

  async function applyMerge() {
    try {
      await api.resolveMatch(selected, {
        surviving_record: survivor,
        merged_payload: merged,
        user: currentUser.user_id,
      });
      notify("Merged ✓ non-survivors retired", "success");
      setSelected(null); setDetails(null); reload();
    } catch (e) { notify(e.message, "error"); }
  }

  async function dismiss() {
    try {
      await api.dismissMatch(selected, { user: currentUser.user_id });
      notify("Match group dismissed", "info");
      setSelected(null); setDetails(null); reload();
    } catch (e) { notify(e.message, "error"); }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Match &amp; Merge</h1>
      <p style={{ color: colors.muted, margin: "0 0 20px", fontSize: 14 }}>
        Duplicate-candidate review and survivorship merge — fuzzy matching across source systems.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        {/* Group list */}
        <div style={{ ...card }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", fontWeight: 600 }}>
            Match Groups ({groups.length})
          </div>
          {groups.length === 0 ? (
            <div style={{ padding: 24, color: colors.muted, fontSize: 13 }}>No match groups.</div>
          ) : groups.map(g => (
            <div key={g.match_group_id} onClick={() => open(g.match_group_id)}
              style={{
                padding: "12px 16px", cursor: "pointer",
                background: selected === g.match_group_id ? "#fef9c3" : "transparent",
                borderBottom: "1px solid #f3f4f6",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.template_key}</div>
                  <div style={{ fontSize: 11, color: colors.muted }}>{g.rule_name}</div>
                </div>
                <span style={pill(g.status === "pending" ? "#fffbeb" : "#f0fdf4",
                                  g.status === "pending" ? "#d97706" : "#16a34a")}>
                  {g.match_score}% · {g.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Details / merge UI */}
        <div style={{ ...card, padding: 20 }}>
          {!details ? (
            <div style={{ color: colors.muted, padding: 40, textAlign: "center" }}>
              ← Select a match group to review
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Side-by-side comparison</h3>
                <span style={pill("#fef9c3", "#92400e")}>Match score: {details.group.match_score}%</span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={thStyle}>Field</th>
                    {details.candidates.map(c => (
                      <th key={c.record_id} style={thStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input type="radio" checked={survivor === c.record_id}
                            onChange={() => { setSurvivor(c.record_id); setMerged({ ...c.payload_json }); }} />
                          <span>{c.business_key} <span style={{ color: colors.muted, fontWeight: 400 }}>({c.source_system})</span></span>
                        </div>
                      </th>
                    ))}
                    <th style={thStyle}>Golden Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(details.candidates.flatMap(c => Object.keys(c.payload_json ?? {})))).map(field => (
                    <tr key={field}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{field}</td>
                      {details.candidates.map(c => {
                        const v = c.payload_json?.[field] ?? "—";
                        const winning = merged[field] === v;
                        return (
                          <td key={c.record_id} style={{ ...tdStyle, background: winning ? "#f0fdf4" : undefined, cursor: "pointer" }}
                            onClick={() => setMerged(m => ({ ...m, [field]: v }))}>
                            {String(v)}
                          </td>
                        );
                      })}
                      <td style={tdStyle}>
                        <input value={merged[field] ?? ""}
                          onChange={e => setMerged(m => ({ ...m, [field]: e.target.value }))}
                          style={{ width: "100%", padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12 }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 18, padding: 12, background: "#eff6ff", borderRadius: 8, fontSize: 12, color: "#1e40af" }}>
                Click a value to copy it to the golden record. The selected radio determines which record_id survives;
                non-survivors will be marked <code>merged</code>.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button style={btn("#6b7280")} onClick={dismiss}>Dismiss (not a duplicate)</button>
                <button style={btn(colors.brand)} onClick={applyMerge}>Apply Merge ✓</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
