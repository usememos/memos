import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<HTMLSpanElement, CheckboxPrimitive.Root.Props>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="checkbox"
      className={cn(
        "peer border-border data-checked:bg-primary data-checked:text-primary-foreground data-checked:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center text-current transition-none">
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
