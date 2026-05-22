import * as React from "react"
import { Progress as ProgressPrimitive, Direction as DirectionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  dual = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { dual?: boolean }) {
  const dir = DirectionPrimitive.useDirection();
  const pct = value || 0;
  const offset = 100 - pct;
  const translateX = dir === "rtl" ? `${offset}%` : `-${offset}%`;
  // dir / translateX still used by the single-color (non-dual) indicator path below

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      dir={dir}
      className={cn(
        "relative flex h-1 w-full overflow-hidden rounded-full",
        dual ? "bg-transparent" : "bg-muted",
        className
      )}
      {...props}
    >
      {dual ? (
        // LTR: primary(left, pct%) | contact(right, rest%)
        // RTL: CSS direction:rtl reverses flex, so same DOM order yields contact(left) | primary(right)
        <>
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          <div className="h-full flex-1 bg-contact transition-all" />
        </>
      ) : (
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="size-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(${translateX})` }}
        />
      )}
    </ProgressPrimitive.Root>
  )
}

export { Progress }
