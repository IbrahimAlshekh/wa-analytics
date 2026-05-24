import { useTranslation } from "react-i18next";
import type { TimelineEntry } from "@/types/timeline";
import { formatTime } from "@/lib/sessions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MediaPreview from "./MediaPreview";
import PresenceLog from "./PresenceLog";

export interface SessionTimelineProps {
  entries: TimelineEntry[];
  contactName: string;
  accountId: number;
  contactId: number;
}

export default function SessionTimeline({
  entries,
  contactName,
  accountId,
  contactId,
}: SessionTimelineProps) {
  const { t } = useTranslation();

  const messages = (entries ?? [])
    .filter((e) => e.kind === "message")
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("timeline.recentMessages")}</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("timeline.noMessages")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {messages.map((e, i) => (
                <div key={i} className="flex items-start gap-2 py-1 text-sm">
                  <time className="text-xs text-muted-foreground shrink-0 min-w-12">
                    {formatTime(e.at)}
                  </time>
                  <div className="flex flex-col">
                    <span>
                      {e.isFromMe ? t("analytics.you") : contactName}:{" "}
                      <em className="not-italic text-foreground">
                        {e.text ||
                          (e.mediaPath ? (
                            ""
                          ) : (
                            <span className="text-muted-foreground">
                              [{e.mediaType || "media"}]
                            </span>
                          ))}
                      </em>
                    </span>
                    {e.mediaPath && (
                      <MediaPreview type={e.mediaType} path={e.mediaPath} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("timeline.statusSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PresenceLog accountId={accountId} contactId={contactId} />
        </CardContent>
      </Card>
    </div>
  );
}
