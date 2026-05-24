import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import type { AnalyticsRange, CustomDateRange } from "@/types/analytics";

interface RangeOption {
  value: Exclude<AnalyticsRange, "custom">;
  labelKey: string;
}

const RANGE_OPTIONS: RangeOption[] = [
  { value: "day",  labelKey: "contactDetail.rangeDaily" },
  { value: "week", labelKey: "contactDetail.rangeWeekly" },
  { value: "all",  labelKey: "contactDetail.rangeGeneral" },
];

export interface AnalyticsRangeFilterProps {
  range: AnalyticsRange;
  customDates: CustomDateRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onCustomDatesChange: (dates: CustomDateRange) => void;
}

function toDate(iso: string): Date | undefined {
  return iso ? parseISO(iso) : undefined;
}

function toISO(date: Date | undefined): string {
  if (!date) return "";
  // Format as YYYY-MM-DD without timezone shifting
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AnalyticsRangeFilter({
  range,
  customDates,
  onRangeChange,
  onCustomDatesChange,
}: AnalyticsRangeFilterProps) {
  const { t } = useTranslation();

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startDate = toDate(customDates.start);
  const endDate   = toDate(customDates.end);

  function handleStartSelect(date: Date | undefined) {
    const newStart = toISO(date);
    // If the current end is before the new start, reset it
    const newEnd =
      customDates.end && customDates.end < newStart ? "" : customDates.end;
    onCustomDatesChange({ start: newStart, end: newEnd });
  }

  function handleEndSelect(date: Date | undefined) {
    onCustomDatesChange({ ...customDates, end: toISO(date) });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Range preset buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("contactDetail.rangeLabel")}
        </span>
        <div className="flex gap-1 flex-wrap">
          {RANGE_OPTIONS.map(({ value, labelKey }) => (
            <Button
              key={value}
              variant={range === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onRangeChange(value)}
            >
              {t(labelKey)}
            </Button>
          ))}
          <Button
            variant={range === "custom" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onRangeChange("custom")}
          >
            {t("contactDetail.rangeCustom")}
          </Button>
        </div>
      </div>

      {/* Custom date pickers — only shown when "custom" is active */}
      {range === "custom" && (
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("contactDetail.rangeFrom")}
            </Label>
            <DatePicker
              value={startDate}
              onChange={handleStartSelect}
              placeholder={t("contactDetail.rangeFrom")}
              toDate={endDate ?? today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("contactDetail.rangeTo")}
            </Label>
            <DatePicker
              value={endDate}
              onChange={handleEndSelect}
              placeholder={t("contactDetail.rangeTo")}
              fromDate={startDate}
              toDate={today}
            />
          </div>
          {(!customDates.start || !customDates.end) && (
            <p className="text-xs text-muted-foreground self-end pb-1">
              {t("contactDetail.rangeCustomHint")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
