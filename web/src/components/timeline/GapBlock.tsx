import { useTranslation } from "react-i18next";
import { formatDuration } from "@/lib/sessions";

export interface GapBlockProps {
  fromAt: number;
  toAt: number;
}

export default function GapBlock({ fromAt, toAt }: GapBlockProps) {
  const { t } = useTranslation();
  const dur = formatDuration(toAt - fromAt);
  return (
    <div className="flex items-center gap-2 py-1 px-3 text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
      <span className="text-sm text-muted-foreground">
        {t("timeline.offlineGap", { duration: dur })}
      </span>
    </div>
  );
}
