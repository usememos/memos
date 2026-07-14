import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";
import { popupMotionClasses } from "./popup";

const TooltipProvider = ({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) => {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
};

const Tooltip = ({ ...props }: TooltipPrimitive.Root.Props) => {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
};

const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipPrimitive.Trigger.Props>(({ ...props }, ref) => {
  return <TooltipPrimitive.Trigger ref={ref} data-slot="tooltip-trigger" {...props} />;
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, align, alignOffset, side, sideOffset = 0, children, ...props }, ref) => {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-tooltip"
      >
        <TooltipPrimitive.Popup
          ref={ref}
          data-slot="tooltip-content"
          className={cn(
            "bg-primary text-primary-foreground z-tooltip w-fit origin-(--transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
            popupMotionClasses,
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="bg-primary z-tooltip size-2.5 rotate-45 rounded-[2px]" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
