import { Progress } from "@/components/ui/progress";

export interface BalanceBarProps {
  mePct: number;
  meLabel: string;
  themLabel: string;
}

export default function BalanceBar({
  mePct,
  meLabel,
  themLabel,
}: BalanceBarProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 text-primary">
          <span className="size-2 rounded-full bg-primary shrink-0" />
          {meLabel}
        </span>
        <span className="flex items-center gap-1.5 text-contact">
          {themLabel}
          <span className="size-2 rounded-full bg-contact shrink-0" />
        </span>
      </div>
      <Progress value={mePct} className="h-2" dual />
    </div>
  );
}
