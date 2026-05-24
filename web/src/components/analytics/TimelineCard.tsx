import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AnalyticsReport } from "@/types/analytics";
import SectionHeader from "./SectionHeader";
import StatItem from "./StatItem";

export interface TimelineCardProps {
  timeline: AnalyticsReport["timeline"];
}

export default function TimelineCard({ timeline }: TimelineCardProps) {
  const { t } = useTranslation();
  if (!timeline.firstMsgUnix) return null;
  const fmt = (unix: number) => new Date(unix * 1000).toLocaleDateString();
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Timeline"
          description={t("analytics.timeline.description")}
          info={t("analytics.timeline.tooltip")}
          icon={CalendarDays}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatItem
            label={t("analytics.timeline.firstMessage")}
            value={fmt(timeline.firstMsgUnix)}
          />
          <StatItem
            label={t("analytics.timeline.lastMessage")}
            value={fmt(timeline.lastMsgUnix)}
          />
          <StatItem
            label={t("analytics.timeline.span")}
            value={`${timeline.spanDays}d`}
          />
          <StatItem
            label={t("analytics.timeline.activeDays")}
            value={String(timeline.daysWithComms)}
          />
          <StatItem
            label={t("analytics.timeline.longestStreak")}
            value={`${timeline.longestStreakDays}d`}
            description={t("analytics.timeline.longestStreakDesc")}
            info={t("analytics.timeline.longestStreakTooltip")}
          />
          {timeline.highestVolumeDayDate && (
            <StatItem
              label={t("analytics.timeline.busiestDay")}
              value={`${timeline.highestVolumeDayDate} (${timeline.highestVolumeDayCount})`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
