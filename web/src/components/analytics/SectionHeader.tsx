import { Info } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  info?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function SectionHeader({
  title,
  description,
  info,
  icon: Icon,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
          {info && (
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="size-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-xs">
                {info}
              </TooltipContent>
            </UITooltip>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground opacity-75 leading-tight">
            {description}
          </p>
        )}
      </div>
      {Icon && (
        <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      )}
    </div>
  );
}
