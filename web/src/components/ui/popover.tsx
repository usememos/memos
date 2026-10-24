import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";
import { cn } from "@/lib/utils";
import { popupMotionClasses, popupSurfaceClasses } from "./popup";

const Popover = ({ ...props }: PopoverPrimitive.Root.Props) => {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
};

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverPrimitive.Trigger.Props>(({ ...props }, ref) => {
  return <PopoverPrimitive.Trigger ref={ref} data-slot="popover-trigger" {...props} />;
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverPrimitive.Popup.Props &
    Pick<PopoverPrimitive.Positioner.Props, "anchor" | "align" | "alignOffset" | "positionMethod" | "side" | "sideOffset">
>(({ className, anchor, align = "center", alignOffset, positionMethod, side, sideOffset = 6, ...props }, ref) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        anchor={anchor}
        align={align}
        alignOffset={alignOffset}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-dropdown"
      >
        <PopoverPrimitive.Popup
          ref={ref}
          data-slot="popover-content"
          className={cn(
            popupSurfaceClasses,
            "z-dropdown w-auto max-w-(--available-width) origin-(--transform-origin) p-1.5 outline-hidden",
            popupMotionClasses,
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverContent, PopoverTrigger };
