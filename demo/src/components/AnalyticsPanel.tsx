import { useTranslation } from "react-i18next";
import type { AnalyticsReport } from "../lib/types";
import { Card, CardContent } from "@/components/ui/card";
import TimelineCard from "./analytics/TimelineCard";
import VolumeCard from "./analytics/VolumeCard";
import InitiationCard from "./analytics/InitiationCard";
import HourHistCard from "./analytics/HourHistCard";
import DowCard from "./analytics/DowCard";
import TemporalMetaCard from "./analytics/TemporalMetaCard";
import EmotionCard from "./analytics/EmotionCard";
import LanguageCard from "./analytics/LanguageCard";
import MonthlyEvolutionCard from "./analytics/MonthlyEvolutionCard";
import IndicatorCard from "./analytics/IndicatorCard";

interface Props {
  report: AnalyticsReport;
  contactName: string;
}

export default function AnalyticsPanel({ report, contactName }: Props) {
  const { t } = useTranslation();
  const { volume, temporal, emotion, timeline, initiation, language, indicators } = report;

  const totalMsgs = volume.me.messages + volume.them.messages;
  if (totalMsgs === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("analytics.noMessages")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TimelineCard timeline={timeline} />
      <VolumeCard me={volume.me} them={volume.them} contactName={contactName} />
      <InitiationCard initiation={initiation} contactName={contactName} />
      <HourHistCard hourMe={temporal.hourHistMe} hourThem={temporal.hourHistThem} contactName={contactName} />
      <DowCard dowMe={temporal.dowMe} dowThem={temporal.dowThem} contactName={contactName} />
      <TemporalMetaCard temporal={temporal} contactName={contactName} />
      <EmotionCard emotion={emotion} contactName={contactName} totalMsgsMe={volume.me.messages} totalMsgsThem={volume.them.messages} />
      <LanguageCard language={language} contactName={contactName} />
      <MonthlyEvolutionCard months={temporal.monthly} contactName={contactName} />
      <IndicatorCard indicators={indicators} />
    </div>
  );
}
