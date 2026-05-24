import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDuration, formatCount } from "@/lib/format";
import type { AnalyticsReport } from "../../lib/types";
import SectionHeader from "./SectionHeader";
import StatItem from "./StatItem";

interface Props {
  indicators: AnalyticsReport["indicators"];
}

export default function IndicatorCard({ indicators }: Props) {
  const { t } = useTranslation();
  const trend = indicators.meShareTrendPct;
  const trendLabel = trend === 0
    ? t("analytics.indicators.shareTrend")
    : trend > 0
      ? t("analytics.indicators.shareTrendUp")
      : t("analytics.indicators.shareTrendDown");

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Indicators"
          description={t("analytics.indicators.description")}
          info={t("analytics.indicators.tooltip")}
          icon={TrendingUp}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatItem
            label={t("analytics.indicators.msgBalance")}
            value={`${indicators.msgBalancePct.toFixed(1)}%`}
            description={t("analytics.indicators.msgBalanceDesc")}
            info={t("analytics.indicators.msgBalanceTooltip")}
          />
          <StatItem
            label={t("analytics.indicators.wordBalance")}
            value={`${indicators.wordBalancePct.toFixed(1)}%`}
            description={t("analytics.indicators.wordBalanceDesc")}
            info={t("analytics.indicators.wordBalanceTooltip")}
          />
          <StatItem
            label={t("analytics.indicators.activeDaysPct")}
            value={`${indicators.dailyConsistencyPct.toFixed(1)}%`}
            description={t("analytics.indicators.activeDaysPctDesc")}
            info={t("analytics.indicators.activeDaysPctTooltip")}
          />
          {indicators.medianRespAllSec > 0 && (
            <StatItem
              label={t("analytics.indicators.medianReply")}
              value={formatDuration(indicators.medianRespAllSec)}
              description={t("analytics.indicators.medianReplyDesc")}
              info={t("analytics.indicators.medianReplyTooltip")}
            />
          )}
          <StatItem
            label={t("analytics.indicators.initiationYou")}
            value={`${indicators.initiationMePct.toFixed(1)}%`}
            description={t("analytics.indicators.initiationYouDesc")}
            info={t("analytics.indicators.initiationYouTooltip")}
          />
          {indicators.syncLaughDays > 0 && (
            <StatItem
              label={t("analytics.indicators.syncLaughDays")}
              value={String(indicators.syncLaughDays)}
              description={t("analytics.indicators.syncLaughDaysDesc")}
              info={t("analytics.indicators.syncLaughDaysTooltip")}
            />
          )}
          {indicators.totalQuestions > 0 && (
            <StatItem
              label={t("analytics.indicators.totalQuestions")}
              value={formatCount(indicators.totalQuestions)}
              description={t("analytics.indicators.totalQuestionsDesc")}
            />
          )}
          {indicators.totalLaughter > 0 && (
            <StatItem
              label={t("analytics.indicators.totalLaughter")}
              value={formatCount(indicators.totalLaughter)}
              description={t("analytics.indicators.totalLaughterDesc")}
            />
          )}
          {trend !== 0 && (
            <StatItem
              label={trendLabel}
              value={`${Math.abs(trend).toFixed(1)}%`}
              description={t("analytics.indicators.shareTrendDesc")}
              info={t("analytics.indicators.shareTrendTooltip")}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
