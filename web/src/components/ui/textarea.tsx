import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border placeholder:text-muted-foreground flex field-sizing-content min-h-20 w-full rounded-md border bg-input px-3 py-2 text-base shadow-xs transition-[color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary/70 focus:outline-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
