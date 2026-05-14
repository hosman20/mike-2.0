import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Mike 2.1 button primitive.
// Primary variant renders as a fully-rounded "ink pill" — near-black accent
// with white text — per docs/mike-2.1-design-tokens.md (Section 4.1, point 1).
// No shadows: hierarchy is conveyed via hairline borders + solid surfaces.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Primary: ink-black pill, white text — the signature shape.
        default:
          "bg-primary text-primary-foreground hover:bg-accent-hover",
        // Destructive: warm-paper rose ink.
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90 focus-visible:ring-destructive/30",
        // Outline: hairline border, transparent surface, ink text.
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-hover hover:border-border-strong",
        // Secondary: warm-paper surface, ink text.
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-hover",
        // Ghost: no chrome at rest, soft surface on hover.
        ghost:
          "bg-transparent text-foreground hover:bg-surface-hover",
        // Link: inline text styling.
        link:
          "bg-transparent text-foreground underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
