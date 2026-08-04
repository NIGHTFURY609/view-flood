import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Sizes are deliberately larger than the shadcn defaults (which bottom out at
 * 36px). Every interactive control in this app must clear the WCAG 2.5.5 44px
 * target — it is used one-handed, outdoors, in an emergency.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold " +
    "cursor-pointer transition-colors duration-(--duration-fast) " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline:
          "border border-input bg-surface text-foreground hover:bg-secondary hover:text-secondary-foreground",
        ghost: "text-foreground hover:bg-secondary hover:text-secondary-foreground",
        critical: "bg-critical text-critical-foreground hover:bg-critical/90",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "min-h-11 px-3 py-2",
        md: "min-h-11 px-4 py-2",
        lg: "min-h-12 px-6 py-3 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the child element (e.g. a router Link) instead of a <button>. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
