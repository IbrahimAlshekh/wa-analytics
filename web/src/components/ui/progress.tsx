import * as React from "react"
import { Progress as ProgressPrimitive, Direction as DirectionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const dir = DirectionPrimitive.useDirection();
  const offset = 100 - (value || 0);
  const translateX = dir === "rtl" ? `${offset}%` : `-${offset}%`;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(${translateX})` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
