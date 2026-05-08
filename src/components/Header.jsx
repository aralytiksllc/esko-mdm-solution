export function Header({ users, currentUser, setCurrentUser }) {
  return (
    <header style={{
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #e94560, #c23152)",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 14,
        }}>MD</div>
        <span style={{ color: "#fff", fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>Master Data Services</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 4 }}>ESKO nv</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span title="Demo: identity is stubbed — in production this is replaced by Microsoft Entra ID SSO (see src/lib/auth.js)"
          style={{
            background: "rgba(245,158,11,0.18)", color: "#fbbf24",
            border: "1px solid rgba(245,158,11,0.35)",
            padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
          }}>DEMO AUTH</span>
        <select value={currentUser?.user_id ?? ""}
          onChange={e => setCurrentUser(users.find(u => u.user_id === e.target.value))}
          style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff", padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          }}>
          {users.map(u => <option key={u.user_id} value={u.user_id} style={{ color: "#1a1a2e" }}>
            {u.user_name} ({u.role_name})
          </option>)}
        </select>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "#e94560",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 600,
        }}>{currentUser?.avatar_initials ?? "?"}</div>
      </div>
    </header>
  );
}