import { useTranslation } from "react-i18next";
import type { Session } from "@/types/session";
import { formatTime, formatDuration } from "@/lib/sessions";

export interface SessionBlockProps {
  session: Session;
}

export default function SessionBlock({ session }: SessionBlockProps) {
  const { t } = useTranslation();
  const start = formatTime(session.startAt);
  const end = session.endAt
    ? formatTime(session.endAt)
    : t("contactDetail.nowLabel");
  const dur =
    session.durationSec != null ? formatDuration(session.durationSec) : null;
  const lastSeenDiff =
    session.lastSeen != null && session.endAt != null
      ? session.endAt - session.lastSeen
      : null;

  return (
    <div className="flex items-start gap-2 py-1.5 px-3 rounded-md bg-primary/5 border border-primary/10">
      <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
      <div className="flex flex-col">
        <span className="text-sm">
          {t("timeline.onlineSession", { start, end })}
          {dur ? (
            <span className="text-xs text-muted-foreground ms-1">({dur})</span>
          ) : null}
        </span>
        {lastSeenDiff != null && lastSeenDiff > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 ms-4">
            {t("timeline.lastActivity", {
              duration: formatDuration(lastSeenDiff),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
