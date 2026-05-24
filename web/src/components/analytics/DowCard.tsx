import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import SectionHeader from "./SectionHeader";
import { DOW_LABELS } from "./constants";

export interface DowCardProps {
  dowMe: number[];
  dowThem: number[];
  contactName: string;
}

export default function DowCard({ dowMe, dowThem, contactName }: DowCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const data = DOW_LABELS.map((label, i) => ({
    label,
    me: dowMe[i] ?? 0,
    them: dowThem[i] ?? 0,
  }));
  const hasData = data.some((d) => d.me > 0 || d.them > 0);
  if (!hasData) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Messages by weekday"
          description={t("analytics.weekday.description")}
          info={t("analytics.weekday.tooltip")}
          icon={CalendarDays}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full h-40">
          <ResponsiveContainer>
            <BarChart data={data} barCategoryGap="25%" barGap={2}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(127,127,127,0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                reversed={isRTL}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={28}
                orientation={isRTL ? "right" : "left"}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }}
              />
              <Bar
                dataKey="me"
                name={t("analytics.you")}
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="them"
                name={contactName}
                fill="var(--contact)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
