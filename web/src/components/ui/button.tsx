import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "./focus";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 motion-reduce:transition-none",
    FOCUS_VISIBLE_OUTLINE_CLASSES,
  ),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 data-popup-open:bg-primary/90 aria-pressed:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border border-border/80 bg-transparent hover:bg-muted/60 hover:text-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 data-popup-open:bg-accent data-popup-open:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        ghost:
          "hover:bg-muted/60 hover:text-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // A quiet control in the spirit of Notion and Linear: 13px muted ink that darkens under
        // a light hover wash, and the accent fill reserved for the one state that is "on" —
        // pressed, current, or holding a popup open.
        quiet:
          "text-ui font-normal text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-[current]:bg-accent aria-[current]:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 gap-1.5 px-2 text-ui",
        lg: "h-9 rounded-md px-4",
        icon: "size-8",
        // The 28px square: the height of `sm`, and the sidebar's compose-control square.
        "icon-compact": "size-7",
        "icon-sm": "size-6",
      },
    },
    compoundVariants: [
      // A quiet chip gives its glyph and label a little more air than the kit's tight `sm`.
      { variant: "quiet", size: "sm", className: "gap-1.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<HTMLElement, ButtonPrimitive.Props & VariantProps<typeof buttonVariants>>(
  ({ className, variant, size, ...props }, ref) => (
    <ButtonPrimitive ref={ref} data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
export type ButtonSize = VariantProps<typeof buttonVariants>["size"];
