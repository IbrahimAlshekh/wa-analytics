export interface MiniStatProps {
  label: string;
  value: string;
}

export default function MiniStat({ label, value }: MiniStatProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
