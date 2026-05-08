// Vertical primary nav. All items visible at once — no horizontal scroll.
// Items are grouped into logical sections matching enterprise MDM tools
// (Semarchy / Profisee), with badges for live counts.

const SECTIONS = [
  {
    title: "Manage",
    items: [
      { key: "dashboard",    label: "Dashboard",    icon: "🏠" },
      { key: "grid",         label: "Data Grid",    icon: "📋" },
      { key: "provisioning", label: "Provisioning", icon: "🛠",  badge: "provisioning" },
    ],
  },
  {
    title: "Quality & Stewardship",
    items: [
      { key: "match",       label: "Match & Merge", icon: "🔗" },
      { key: "dq",          label: "Data Quality",  icon: "✓"  },
      { key: "stewardship", label: "Stewardship",   icon: "📥", badge: "tasks" },
    ],
  },
  {
    title: "Reference & Model",
    items: [
      { key: "hierarchy", label: "Hierarchy",    icon: "🌳" },
      { key: "glossary",  label: "Glossary",     icon: "📖" },
      { key: "model",     label: "Entity Model", icon: "🧩" },
    ],
  },
  {
    title: "Audit & Distribution",
    items: [
      { key: "history",   label: "History",   icon: "🕐" },
      { key: "reconcile", label: "Reconcile", icon: "🔄" },
    ],
  },
];

export function Sidebar({ activeView, setActiveView, taskCount = 0, provisioningPending = 0 }) {
  function badgeFor(b) {
    if (b === "tasks" && taskCount > 0) return { count: taskCount, color: "#f59e0b" };
    if (b === "provisioning" && provisioningPending > 0) return { count: provisioningPending, color: "#7c3aed" };
    return null;
  }

  return (
    <aside style={{
      width: 220, minHeight: "calc(100vh - 60px)",
      background: "linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      padding: "16px 0", flexShrink: 0,
      position: "sticky", top: 60, alignSelf: "flex-start",
    }}>
      {SECTIONS.map((sec, si) => (
        <div key={sec.title} style={{ marginBottom: 14 }}>
          <div style={{
            padding: "0 18px 6px", fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
          }}>{sec.title}</div>
          {sec.items.map(item => {
            const active = activeView === item.key;
            const badge = badgeFor(item.badge);
            return (
              <button key={item.key} onClick={() => setActiveView(item.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "8px 18px",
                  background: active ? "rgba(233,69,96,0.18)" : "transparent",
                  borderLeft: active ? "3px solid #e94560" : "3px solid transparent",
                  color: active ? "#ff6b88" : "rgba(255,255,255,0.72)",
                  border: "none", borderRight: "none", borderTop: "none", borderBottom: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500,
                  textAlign: "left", transition: "all .12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, background: badge.color, color: "#fff",
                    fontSize: 10, fontWeight: 700, padding: "0 5px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{badge.count}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}