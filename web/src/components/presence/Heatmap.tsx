import { useState } from "react";

export interface HeatmapProps {
  data: { date: string; minutes: number }[];
}

export default function Heatmap({ data }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const weeks: { date: string; minutes: number; dow: number }[][] = [];
  let week: { date: string; minutes: number; dow: number }[] = [];

  for (const d of data) {
    const dow = new Date(d.date + "T00:00:00").getDay();
    const monDow = dow === 0 ? 6 : dow - 1;
    if (week.length === 0 && monDow !== 0) {
      for (let i = 0; i < monDow; i++)
        week.push({ date: "", minutes: -1, dow: i });
    }
    week.push({ ...d, dow: monDow });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);

  const maxMin = Math.max(...data.map((d) => d.minutes), 1);
  const cellColor = (min: number) => {
    if (min < 0) return "transparent";
    if (min === 0) return "oklch(0.225 0.013 255)";
    const intensity = Math.min(min / maxMin, 1);
    return `rgba(22,163,74,${0.15 + intensity * 0.85})`;
  };

  const monthLabels = weeks.map((w) => {
    const first = w.find((c) => c.date);
    if (!first) return "";
    const d = new Date(first.date + "T00:00:00");
    return d.getDate() <= 7
      ? d.toLocaleString("default", { month: "short" })
      : "";
  });

  const CELL_H = 14;
  const GAP = 3;
  const DAY_LABELS = ["M", "", "W", "", "F", "", "S"];

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", marginBottom: 6, paddingLeft: 18 }}>
        {weeks.map((_, wi) => (
          <div
            key={wi}
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: 600,
              color: "var(--fg-muted)",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {monthLabels[wi]}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: GAP,
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: GAP,
            flexShrink: 0,
            width: 14,
          }}
        >
          {DAY_LABELS.map((l, i) => (
            <div
              key={i}
              style={{
                height: CELL_H,
                fontSize: 9,
                lineHeight: `${CELL_H}px`,
                color: "var(--fg-muted)",
                textAlign: "right",
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {weeks.map((w, wi) => (
          <div
            key={wi}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: GAP,
            }}
          >
            {Array.from({ length: 7 }, (_, di) => {
              const cell = w[di];
              return (
                <div
                  key={di}
                  style={{
                    height: CELL_H,
                    borderRadius: 3,
                    backgroundColor: cell
                      ? cellColor(cell.minutes)
                      : "transparent",
                    cursor: cell && cell.date ? "default" : undefined,
                  }}
                  onMouseEnter={
                    cell && cell.date
                      ? (e) => {
                          const r = (
                            e.target as HTMLElement
                          ).getBoundingClientRect();
                          setTooltip({
                            text: `${cell.date}: ${cell.minutes}m`,
                            x: r.left,
                            y: r.top - 28,
                          });
                        }
                      : undefined
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="fixed bg-card border border-border rounded text-xs pointer-events-none z-999 px-2 py-0.5"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
