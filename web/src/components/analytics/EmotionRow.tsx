import { Progress } from "@/components/ui/progress";
import { formatCount } from "@/lib/format";

export interface EmotionRowProps {
  icon: string;
  label: string;
  me: number;
  them: number;
}

export default function EmotionRow({ icon, label, me, them }: EmotionRowProps) {
  const total = me + them;
  const mePct = total > 0 ? (me / total) * 100 : 50;
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 text-center text-sm shrink-0">{icon}</span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="w-20 text-xs text-muted-foreground shrink-0">
          {label}
        </span>
        <Progress value={mePct} className="flex-1 h-1.5" dual />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-end tabular-nums shrink-0">
        {formatCount(me)}
      </span>
      <span className="text-xs text-muted-foreground/50">|</span>
      <span className="text-xs text-muted-foreground w-8 tabular-nums shrink-0">
        {formatCount(them)}
      </span>
    </div>
  );
}
