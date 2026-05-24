import { Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  label: string;
  value: string;
  description?: string;
  info?: string;
}

export default function StatItem({ label, value, description, info }: Props) {
  return (
    <div className="flex flex-col gap-0.5 min-w-24">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {info && (
          <UITooltip>
            <TooltipTrigger asChild>
              <Info className="size-2.5 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-xs">{info}</TooltipContent>
          </UITooltip>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground/60 leading-tight">{description}</p>
      )}
      <span className="text-lg font-bold tracking-tight">{value}</span>
    </div>
  );
}
