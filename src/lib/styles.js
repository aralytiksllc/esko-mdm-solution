// Shared style helpers + tokens
export const colors = {
  bg: "#f8f9fb",
  ink: "#1a1a2e",
  muted: "#6b7280",
  line: "#e5e7eb",
  panel: "#fff",
  brand: "#e94560",
  brandDark: "#c23152",
  accentBlue: "#2563eb",
  accentGreen: "#16a34a",
  accentAmber: "#d97706",
  accentRed: "#dc2626",
  accentPurple: "#7c3aed",
  navy: "#0f3460",
};

export const thStyle = {
  padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12,
  color: colors.muted, borderBottom: "2px solid " + colors.line, whiteSpace: "nowrap",
  textTransform: "uppercase", letterSpacing: "0.5px",
};

export const tdStyle = {
  padding: "8px 14px", borderBottom: "1px solid #f3f4f6",
  position: "relative", whiteSpace: "nowrap",
};

export function btn(bg, opts = {}) {
  return {
    background: bg, color: "#fff", border: "none", padding: "8px 16px",
    borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
    whiteSpace: "nowrap", transition: "all .2s", ...opts,
  };
}

export function pill(bg, color) {
  return {
    fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
    background: bg, color,
  };
}

export const card = {
  background: colors.panel, borderRadius: 14, border: "1px solid " + colors.line,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

export function priorityColor(p) {
  return p === "critical" ? colors.accentRed
    : p === "high" ? colors.accentAmber
    : p === "med" ? colors.accentBlue
    : colors.muted;
}

export function dqColor(score) {
  if (score == null) return colors.muted;
  if (score >= 95) return colors.accentGreen;
  if (score >= 85) return colors.accentBlue;
  if (score >= 70) return colors.accentAmber;
  return colors.accentRed;
}
