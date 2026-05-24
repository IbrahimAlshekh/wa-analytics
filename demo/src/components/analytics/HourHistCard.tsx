import { useTranslation } from "react-i18next";
import { BarChart2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import SectionHeader from "./SectionHeader";

interface Props {
  hourMe: number[];
  hourThem: number[];
  contactName: string;
}

export default function HourHistCard({ hourMe, hourThem, contactName }: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const data = hourMe.map((me, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    me,
    them: hourThem[h] ?? 0,
  }));
  const hasData = data.some((d) => d.me > 0 || d.them > 0);
  if (!hasData) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Messages by hour"
          description={t("analytics.hourly.description")}
          info={t("analytics.hourly.tooltip")}
          icon={BarChart2}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full h-44">
          <ResponsiveContainer>
            <BarChart data={data} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={2} reversed={isRTL} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} orientation={isRTL ? "right" : "left"} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }} />
              <Bar dataKey="me" name={t("analytics.you")} fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="them" name={contactName} fill="var(--contact)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
