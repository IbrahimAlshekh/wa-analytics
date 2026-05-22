import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { Clock, Image, FileText, BarChart2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { formatDuration } from "@/lib/format";

interface Props {
  accountId: number;
  contactId: number;
}

export default function StatsStrip({ accountId, contactId }: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const stats = useQuery({
    queryKey: ["stats", accountId, contactId, range],
    queryFn: () => api.stats(accountId, contactId, range),
    refetchInterval: 60_000,
  });

  const data = (stats.data?.days ?? []).map((d) => ({
    date: d.date.slice(5),
    minutes: Math.round(d.onlineSeconds / 60),
  }));

  const RANGES: { value: "today" | "week" | "month"; label: string }[] = [
    { value: "today", label: t("stats.today") },
    { value: "week", label: t("stats.week") },
    { value: "month", label: t("stats.month") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Range selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("stats.activitySummary")}
        </span>
        <div className="flex gap-1 ms-auto">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              variant={range === r.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title={t("stats.onlineTime")}
          value={formatDuration(stats.data?.onlineSecondsAll ?? 0)}
          description={t("stats.onlineTimeDesc")}
          info={t("stats.onlineTimeTooltip")}
          icon={Clock}
        />
        <StatCard
          title={t("stats.picChanges")}
          value={stats.data?.pictureChanges ?? 0}
          description={t("stats.picChangesDesc")}
          info={t("stats.picChangesTooltip")}
          icon={Image}
        />
        <StatCard
          title={t("stats.aboutChanges")}
          value={stats.data?.aboutChanges ?? 0}
          description={t("stats.aboutChangesDesc")}
          info={t("stats.aboutChangesTooltip")}
          icon={FileText}
        />
      </div>

      {/* Activity chart */}
      <ChartCard
        title={t("stats.chartLabel")}
        description={t("stats.chartDesc")}
        info={t("stats.chartTooltip")}
        icon={BarChart2}
      >
        <div className="w-full h-48">
          <ResponsiveContainer>
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} reversed={isRTL} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={32} orientation={isRTL ? "right" : "left"} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "oklch(0.723 0.173 145 / 0.1)" }}
              />
              <Bar dataKey="minutes" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
