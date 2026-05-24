import { Info } from "lucide-react";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface InfoIconProps {
  text: string;
}

export default function InfoIcon({ text }: InfoIconProps) {
  return (
    <ShadTooltip>
      <TooltipTrigger asChild>
        <Info className="size-3 text-muted-foreground/60 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-xs">{text}</TooltipContent>
    </ShadTooltip>
  );
}
