import { useTranslation } from "react-i18next";
import { formatTime } from "../../lib/sessions";
import type { NonPresence } from "../../lib/sessions";
import { getMediaUrl } from "../../lib/media";

interface Props {
  ev: NonPresence;
}

export default function EventBlock({ ev }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <time className="text-xs text-muted-foreground shrink-0 min-w-12">{formatTime(ev.at)}</time>
      {ev.kind === "picture" ? (
        <span>
          {t("timeline.picChanged")}
          {ev.mediaPath ? (
            <> <a href={getMediaUrl(ev.mediaPath)} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">{t("timeline.view")}</a></>
          ) : null}
        </span>
      ) : (
        <span>{t("timeline.aboutUpdated")} <em>{ev.text || t("timeline.aboutEmpty")}</em></span>
      )}
    </div>
  );
}
