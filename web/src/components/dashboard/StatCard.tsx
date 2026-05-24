import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  info?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export default function StatCard({
  title,
  value,
  description,
  info,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("gap-2", className)}>
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              {title}
              {info && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3 text-muted-foreground/60 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-56 text-xs">
                    {info}
                  </TooltipContent>
                </Tooltip>
              )}
            </CardTitle>
            {description && (
              <CardDescription className="text-xs leading-tight opacity-75">
                {description}
              </CardDescription>
            )}
          </div>
          {Icon && (
            <Icon
              className={cn(
                "size-4 shrink-0 mt-0.5",
                trend === "up"
                  ? "text-primary"
                  : trend === "down"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <span
          className={cn(
            "text-2xl font-bold tracking-tight",
            trend === "up"
              ? "text-primary"
              : trend === "down"
                ? "text-destructive"
                : "text-foreground",
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
