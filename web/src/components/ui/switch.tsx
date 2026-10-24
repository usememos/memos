import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";
import { FIELD_FOCUS_CLASSES } from "./focus";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-checked:bg-primary data-unchecked:bg-muted-foreground/30 inline-flex h-5 w-8 shrink-0 items-center rounded-full border border-transparent p-px transition-[background-color,border-color] duration-150 data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
        FIELD_FOCUS_CLASSES,
        "focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-control-thumb pointer-events-none block size-4 rounded-full shadow-xs transition-transform duration-150 data-checked:translate-x-3 data-unchecked:translate-x-0 rtl:data-checked:-translate-x-3 motion-reduce:transition-none",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
