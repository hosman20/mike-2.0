import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Mike 2.1 badge / pill primitive.
// Fully-rounded pill shape (radius 999), ink palette by default.
// Outline variant uses the hairline border token. No shadows.
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        // Default: ink pill on white text.
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-accent-hover",
        // Secondary: warm-paper surface, ink text.
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-surface-hover",
        // Destructive: rose ink pill.
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:opacity-90 focus-visible:ring-destructive/30",
        // Outline: hairline border, transparent surface, ink text.
        outline:
          "border-border bg-transparent text-foreground [a&]:hover:bg-surface-hover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
