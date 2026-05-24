import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineEntry } from "../lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatElapsed(startAt: number): string {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - startAt));
  if (elapsed < 60) return `${elapsed}s`;
  const m = Math.floor(elapsed / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

interface Session {
  startAt: number;
  endAt: number | null;
  durationSec: number | null;
}

function buildRecentSessions(entries: TimelineEntry[]): Session[] {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);

  const sessions: Session[] = [];
  let start: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      if (start === null) start = p.at;
    } else if (p.state === "unavailable" && start != null) {
      sessions.push({ startAt: start, endAt: p.at, durationSec: p.at - start });
      start = null;
    }
  }
  if (start != null) {
    sessions.push({ startAt: start, endAt: null, durationSec: null });
  }

  const merged: Session[] = [];
  for (const s of sessions) {
    const prev = merged[merged.length - 1];
    if (prev && prev.endAt != null && s.startAt - prev.endAt <= 120) {
      prev.endAt = s.endAt;
      prev.durationSec = prev.endAt != null ? prev.endAt - prev.startAt : null;
    } else {
      merged.push({ ...s });
    }
  }

  return merged.slice(-8).reverse();
}

interface Props {
  entries: TimelineEntry[];
  isOnline: boolean;
  sessionStart: number | null;
  lastPresence: TimelineEntry | undefined;
}

export default function LiveStatusCard({ entries, isOnline, sessionStart, lastPresence }: Props) {
  const { t } = useTranslation();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isOnline]);

  const recentSessions = useMemo(() => buildRecentSessions(entries), [entries]);

  const lastSeenText = !isOnline && lastPresence
    ? lastPresence.lastSeen
      ? t("contactDetail.lastSeen", { time: formatRelative(lastPresence.lastSeen) })
      : t("contactDetail.lastSeen", { time: formatRelative(lastPresence.at) })
    : null;

  const elapsed = isOnline && sessionStart != null ? formatElapsed(sessionStart) : null;

  return (
    <Card className={cn(
      "border",
      isOnline ? "border-primary/30 bg-primary/5" : "border-border",
    )}>
      <CardContent className="pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={cn(
              "size-3.5 rounded-full shrink-0",
              isOnline ? "bg-primary shadow-[0_0_0_4px_oklch(0.723_0.173_145/0.2)]" : "bg-muted-foreground/40",
            )} />
            <div>
              <p className="font-semibold text-sm">
                {isOnline ? t("contactDetail.online") : t("contactDetail.offline")}
              </p>
              {elapsed && (
                <p className="text-xs text-muted-foreground">
                  {t("contactDetail.onlineFor", { elapsed })}
                </p>
              )}
              {lastSeenText && (
                <p className="text-xs text-muted-foreground">{lastSeenText}</p>
              )}
            </div>
          </div>
          {isOnline && sessionStart != null && (
            <span className="text-xs text-primary font-medium">
              {t("contactDetail.onlineSince", { time: formatTime(sessionStart) })}
            </span>
          )}
        </div>

        {recentSessions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("contactDetail.recentSessions")}
            </p>
            {recentSessions.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "size-1.5 rounded-full shrink-0",
                  s.endAt == null ? "bg-primary" : "bg-muted-foreground/50",
                )} />
                <span className="text-foreground">
                  {formatTime(s.startAt)}
                  {s.endAt ? ` – ${formatTime(s.endAt)}` : ` – ${t("contactDetail.nowLabel")}`}
                </span>
                {s.durationSec != null && (
                  <span className="text-muted-foreground ms-auto">{formatDuration(s.durationSec)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
