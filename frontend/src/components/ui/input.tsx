import * as React from "react"

import { cn } from "@/lib/utils"

// Mike 2.1 input primitive.
// Hairline border (1px, var(--border)), no shadow, slight inner radius
// (--radius-sm = 6px). Focus state lifts the border to ink and adds a
// translucent accent glow ring.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "placeholder:text-text-dim text-foreground bg-surface border-border h-9 w-full min-w-0 rounded-sm border px-3 py-1 text-sm transition-colors outline-none",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "selection:bg-accent-soft selection:text-foreground",
        "focus-visible:border-border-active focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
