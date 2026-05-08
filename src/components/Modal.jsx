export function Modal({ onClose, title, children, width = 540 }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 900, animation: "fadeIn .2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 28, width: "90%", maxWidth: width,
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none", width: 32, height: 32, borderRadius: 8,
            cursor: "pointer", fontSize: 16, color: "#6b7280",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
