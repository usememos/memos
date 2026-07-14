import { Radio } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { CircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />;
}

function RadioGroupItem({ className, ...props }: Radio.Root.Props) {
  return (
    <Radio.Root
      data-slot="radio-group-item"
      className={cn(
        "border-border text-primary aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Radio.Indicator data-slot="radio-group-indicator" className="relative flex items-center justify-center">
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </Radio.Indicator>
    </Radio.Root>
  );
}

export { RadioGroup, RadioGroupItem };
