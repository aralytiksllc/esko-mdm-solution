export function Toast({ notification }) {
  if (!notification) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 1000, padding: "12px 20px",
      borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 500, maxWidth: 400,
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)", animation: "slideIn .3s ease",
      background: notification.type === "success" ? "#16a34a"
                : notification.type === "error"   ? "#dc2626"
                : "#2563eb",
    }}>{notification.msg}</div>
  );
}
