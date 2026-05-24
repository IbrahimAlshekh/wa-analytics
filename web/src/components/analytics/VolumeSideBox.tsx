import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { AnalyticsVolumeSide } from "@/types/analytics";
import MiniStat from "./MiniStat";

export interface VolumeSideBoxProps {
  label: string;
  side: AnalyticsVolumeSide;
  accent: string;
}

export default function VolumeSideBox({
  label,
  side,
  accent,
}: VolumeSideBoxProps) {
  const { t } = useTranslation();
  const media =
    side.voiceNotes +
    side.photos +
    side.videos +
    side.stickers +
    side.documents;
  return (
    <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-2">
      <span
        className={cn("text-xs font-bold uppercase tracking-wider", accent)}
      >
        {label}
      </span>
      <div className="flex flex-col gap-1.5">
        <MiniStat
          label={t("analytics.volume.messages")}
          value={formatCount(side.messages)}
        />
        <MiniStat
          label={t("analytics.volume.words")}
          value={formatCount(side.words)}
        />
        <MiniStat
          label={t("analytics.volume.avgWords")}
          value={side.avgWordsPerMsg.toFixed(1)}
        />
        {side.voiceNotes > 0 && (
          <MiniStat
            label={t("analytics.volume.voiceNotes")}
            value={formatCount(side.voiceNotes)}
          />
        )}
        {side.photos > 0 && (
          <MiniStat
            label={t("analytics.volume.photos")}
            value={formatCount(side.photos)}
          />
        )}
        {side.videos > 0 && (
          <MiniStat
            label={t("analytics.volume.videos")}
            value={formatCount(side.videos)}
          />
        )}
        {side.stickers > 0 && (
          <MiniStat
            label={t("analytics.volume.stickers")}
            value={formatCount(side.stickers)}
          />
        )}
        {side.documents > 0 && (
          <MiniStat
            label={t("analytics.volume.docs")}
            value={formatCount(side.documents)}
          />
        )}
        {side.links > 0 && (
          <MiniStat
            label={t("analytics.volume.links")}
            value={formatCount(side.links)}
          />
        )}
        {media > 0 && (
          <MiniStat
            label={t("analytics.volume.totalMedia")}
            value={formatCount(media)}
          />
        )}
      </div>
    </div>
  );
}
