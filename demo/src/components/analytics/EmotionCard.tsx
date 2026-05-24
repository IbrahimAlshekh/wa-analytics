import { useTranslation } from "react-i18next";
import { Smile } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AnalyticsReport } from "../../lib/types";
import SectionHeader from "./SectionHeader";
import StatItem from "./StatItem";
import EmotionSubHeader from "./EmotionSubHeader";
import EmotionRow from "./EmotionRow";
import { EMOTION_KEYS, EMOTION_ICONS } from "./constants";

interface Props {
  emotion: AnalyticsReport["emotion"];
  contactName: string;
  totalMsgsMe: number;
  totalMsgsThem: number;
}

export default function EmotionCard({ emotion, contactName, totalMsgsMe, totalMsgsThem }: Props) {
  const { t } = useTranslation();

  const totalEmotionMe = EMOTION_KEYS.reduce((s, k) => s + (emotion.countsMe[k] ?? 0), 0)
    + emotion.laughterMsgsMe + emotion.questionsMe;
  const totalEmotionThem = EMOTION_KEYS.reduce((s, k) => s + (emotion.countsThem[k] ?? 0), 0)
    + emotion.laughterMsgsThem + emotion.questionsThem;
  const indexMe = totalMsgsMe > 0 ? (totalEmotionMe / totalMsgsMe) * 100 : 0;
  const indexThem = totalMsgsThem > 0 ? (totalEmotionThem / totalMsgsThem) * 100 : 0;
  const totalMsgs = totalMsgsMe + totalMsgsThem;
  const indexCombined = totalMsgs > 0 ? ((totalEmotionMe + totalEmotionThem) / totalMsgs) * 100 : 0;

  const hasLaughs = emotion.laughterMsgsMe + emotion.laughterMsgsThem > 0;
  const hasQuestions = emotion.questionsMe + emotion.questionsThem > 0;
  const hasEmotion = EMOTION_KEYS.some((k) => (emotion.countsMe[k] ?? 0) > 0 || (emotion.countsThem[k] ?? 0) > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title={t("analytics.emotion.title")}
          description={t("analytics.emotion.description")}
          info={t("analytics.emotion.tooltip")}
          icon={Smile}
        />
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-4">
        <div className="rounded-md bg-muted/40 p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("analytics.emotion.indexTitle")}</p>
          <div className="grid grid-cols-3 gap-3">
            <StatItem label={t("analytics.emotion.indexYou")} value={`${indexMe.toFixed(1)}%`} />
            <StatItem label={t("analytics.emotion.indexThem", { name: contactName })} value={`${indexThem.toFixed(1)}%`} />
            <StatItem label={t("analytics.emotion.indexCombined")} value={`${indexCombined.toFixed(1)}%`} />
          </div>
        </div>

        {(hasLaughs || hasQuestions) && (
          <div className="flex flex-col gap-1.5">
            <EmotionSubHeader title={t("analytics.emotion.humor")} />
            {hasLaughs && (
              <EmotionRow icon="😂" label={t("analytics.emotion.laughsLabel")} me={emotion.laughterMsgsMe} them={emotion.laughterMsgsThem} />
            )}
            {hasQuestions && (
              <EmotionRow icon="❓" label={t("analytics.emotion.questionsLabel")} me={emotion.questionsMe} them={emotion.questionsThem} />
            )}
          </div>
        )}

        {hasEmotion && (
          <div className="flex flex-col gap-1.5">
            <EmotionSubHeader title={t("analytics.emotion.tone")} />
            {EMOTION_KEYS.map((k) => {
              const me = emotion.countsMe[k] ?? 0;
              const them = emotion.countsThem[k] ?? 0;
              if (me === 0 && them === 0) return null;
              return <EmotionRow key={k} icon={EMOTION_ICONS[k]} label={t(`analytics.emotion.categories.${k}`)} me={me} them={them} />;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
