import * as React from "react";
import { cn } from "@/lib/utils";
import { FIELD_FOCUS_CLASSES } from "./focus";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border/80 placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base leading-6 transition-[color,border-color,background-color] duration-150 hover:not-disabled:border-input disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 md:text-sm md:leading-5 motion-reduce:transition-none",
        FIELD_FOCUS_CLASSES,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
