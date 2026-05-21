import { useState } from "react";

export function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 5, cursor: "help", verticalAlign: "middle" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span style={{
        fontSize: 10, color: "var(--fg-muted)", border: "1px solid currentColor",
        borderRadius: "50%", width: 13, height: 13, display: "inline-flex",
        alignItems: "center", justifyContent: "center", fontWeight: 700, opacity: 0.55,
        userSelect: "none", flexShrink: 0,
      }}>
        i
      </span>
      {visible && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 11,
          color: "var(--fg)",
          lineHeight: 1.55,
          width: 230,
          zIndex: 200,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          pointerEvents: "none",
          whiteSpace: "normal",
        }}>
          {text}
        </div>
      )}
    </span>
  );
}
