import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AnalyticsReport } from "../../lib/types";
import SectionHeader from "./SectionHeader";
import StatItem from "./StatItem";

interface Props {
  temporal: AnalyticsReport["temporal"];
  contactName: string;
}

export default function TemporalMetaCard({ temporal, contactName }: Props) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Temporal patterns"
          description={t("analytics.temporal.description")}
          info={t("analytics.temporal.tooltip")}
          icon={Clock}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          <StatItem label={t("analytics.temporal.nightYou")} value={`${temporal.nightPctMe.toFixed(1)}%`} />
          <StatItem label={t("analytics.temporal.nightThem", { name: contactName })} value={`${temporal.nightPctThem.toFixed(1)}%`} />
        </div>
      </CardContent>
    </Card>
  );
}
