import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import type { AnalyticsReport } from "@/types/analytics";
import SectionHeader from "./SectionHeader";
import StatItem from "./StatItem";
import BalanceBar from "./BalanceBar";

export interface InitiationCardProps {
  initiation: AnalyticsReport["initiation"];
  contactName: string;
}

export default function InitiationCard({
  initiation,
  contactName,
}: InitiationCardProps) {
  const { t } = useTranslation();
  if (initiation.sessions === 0) return null;
  const mePct = initiation.initiationMeSharePct;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Initiation & Response"
          description={t("analytics.initiation.description")}
          info={t("analytics.initiation.tooltip")}
          icon={TrendingUp}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <BalanceBar
          mePct={mePct}
          meLabel={t("analytics.initiation.youStarted", {
            pct: mePct.toFixed(1),
          })}
          themLabel={t("analytics.initiation.themPct", {
            name: contactName,
            pct: (100 - mePct).toFixed(1),
          })}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatItem
            label={t("analytics.initiation.sessions")}
            value={String(initiation.sessions)}
          />
          <StatItem
            label={t("analytics.initiation.avgMsgsPerSession")}
            value={initiation.avgSessionMsgs.toFixed(1)}
          />
          {initiation.avgRespMeSec > 0 && (
            <StatItem
              label={t("analytics.initiation.avgReplyYou")}
              value={formatDuration(initiation.avgRespMeSec)}
            />
          )}
          {initiation.avgRespThemSec > 0 && (
            <StatItem
              label={t("analytics.initiation.avgReplyThem", {
                name: contactName,
              })}
              value={formatDuration(initiation.avgRespThemSec)}
            />
          )}
          {initiation.medianRespMeSec > 0 && (
            <StatItem
              label={t("analytics.initiation.medianReplyYou")}
              value={formatDuration(initiation.medianRespMeSec)}
            />
          )}
          {initiation.medianRespThemSec > 0 && (
            <StatItem
              label={t("analytics.initiation.medianReplyThem", {
                name: contactName,
              })}
              value={formatDuration(initiation.medianRespThemSec)}
            />
          )}
          {initiation.longestSilenceSec > 0 && (
            <StatItem
              label={t("analytics.initiation.longestSilence")}
              value={formatDuration(initiation.longestSilenceSec)}
              description={t("analytics.initiation.longestSilenceDesc")}
              info={t("analytics.initiation.longestSilenceTooltip")}
            />
          )}
          {initiation.avgSilenceSec > 0 && (
            <StatItem
              label={t("analytics.initiation.avgSilence")}
              value={formatDuration(initiation.avgSilenceSec)}
              description={t("analytics.initiation.avgSilenceDesc")}
              info={t("analytics.initiation.avgSilenceTooltip")}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
