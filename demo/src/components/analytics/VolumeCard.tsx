import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AnalyticsVolumeSide } from "../../lib/types";
import SectionHeader from "./SectionHeader";
import BalanceBar from "./BalanceBar";
import VolumeSideBox from "./VolumeSideBox";

interface Props {
  me: AnalyticsVolumeSide;
  them: AnalyticsVolumeSide;
  contactName: string;
}

export default function VolumeCard({ me, them, contactName }: Props) {
  const { t } = useTranslation();
  const total = me.messages + them.messages;
  const meBar = total > 0 ? (me.messages / total) * 100 : 50;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Volume"
          description={t("analytics.volume.description")}
          info={t("analytics.volume.tooltip")}
          icon={MessageSquare}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <BalanceBar
          mePct={meBar}
          meLabel={t("analytics.volume.youPct", { pct: me.sharePct.toFixed(1) })}
          themLabel={t("analytics.volume.themPct", { name: contactName, pct: them.sharePct.toFixed(1) })}
        />
        <div className="grid grid-cols-2 gap-4">
          <VolumeSideBox label={t("analytics.you")} side={me} accent="text-primary" />
          <VolumeSideBox label={contactName} side={them} accent="text-contact" />
        </div>
      </CardContent>
    </Card>
  );
}
