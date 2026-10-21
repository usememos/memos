import * as React from "react";
import { cn } from "@/lib/utils";
import { FIELD_FOCUS_CLASSES } from "./focus";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-border/80 flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base transition-[color,border-color,background-color] duration-150 hover:not-disabled:border-input file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 md:text-sm motion-reduce:transition-none",
        FIELD_FOCUS_CLASSES,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
