import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthRow } from "../../lib/types";
import SectionHeader from "./SectionHeader";

interface Props {
  months: MonthRow[];
  contactName: string;
}

export default function MonthlyEvolutionCard({ months, contactName }: Props) {
  const { t } = useTranslation();
  if (!months || months.length < 2) return null;
  const recent3 = new Set(months.slice(-3).map((m) => m.month));
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Monthly evolution"
          description={t("analytics.monthly.description")}
          info={t("analytics.monthly.tooltip")}
          icon={TrendingUp}
        />
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {[
                { key: "month", label: t("analytics.monthly.month"), align: "left" },
                { key: "you", label: t("analytics.monthly.you"), align: "right" },
                { key: "them", label: contactName, align: "right" },
                { key: "total", label: t("analytics.monthly.total"), align: "right" },
                { key: "yourPct", label: t("analytics.monthly.yourPct"), align: "right" },
              ].map((h) => (
                <th
                  key={h.key}
                  className={cn(
                    "py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border",
                    h.align === "right" ? "text-end" : "text-start",
                  )}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className={cn("border-b border-border", recent3.has(m.month) && "font-bold")}>
                <td className="py-1.5 px-2">{m.month}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{formatCount(m.me)}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{formatCount(m.them)}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{formatCount(m.total)}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{m.meSharePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
