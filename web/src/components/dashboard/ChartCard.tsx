import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface ChartCardProps {
  title: string;
  description?: string;
  info?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, description, info, icon: Icon, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
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
          {Icon && <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}
