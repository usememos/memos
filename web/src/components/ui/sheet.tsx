import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Sheet = ({ ...props }: SheetPrimitive.Root.Props) => {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
};

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetPrimitive.Trigger.Props>(({ ...props }, ref) => {
  return <SheetPrimitive.Trigger ref={ref} data-slot="sheet-trigger" {...props} />;
});
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = React.forwardRef<HTMLButtonElement, SheetPrimitive.Close.Props>(({ ...props }, ref) => {
  return <SheetPrimitive.Close ref={ref} data-slot="sheet-close" {...props} />;
});
SheetClose.displayName = "SheetClose";

const SheetPortal = ({ ...props }: SheetPrimitive.Portal.Props) => {
  return <SheetPrimitive.Portal {...props} />;
};

const SheetOverlay = React.forwardRef<HTMLDivElement, SheetPrimitive.Backdrop.Props>(({ className, ...props }, ref) => {
  return (
    <SheetPrimitive.Backdrop
      ref={ref}
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-overlay bg-foreground/50 transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
});
SheetOverlay.displayName = "SheetOverlay";

const SheetContent = React.forwardRef<
  HTMLDivElement,
  SheetPrimitive.Popup.Props & {
    side?: "top" | "right" | "bottom" | "left";
  }
>(({ className, children, side = "right", ...props }, ref) => {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        ref={ref}
        data-slot="sheet-content"
        className={cn(
          "bg-background fixed z-overlay flex flex-col gap-4 shadow-lg transition-transform duration-500 ease-in-out data-ending-style:duration-300",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-starting-style:translate-x-full data-ending-style:translate-x-full sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-starting-style:-translate-x-full data-ending-style:-translate-x-full sm:max-w-sm",
          side === "top" && "inset-x-0 top-0 h-auto border-b data-starting-style:-translate-y-full data-ending-style:-translate-y-full",
          side === "bottom" && "inset-x-0 bottom-0 h-auto border-t data-starting-style:translate-y-full data-ending-style:translate-y-full",
          className,
        )}
        initialFocus={false}
        finalFocus={false}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background absolute top-4 right-4 rounded-xs opacity-60 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-5" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
});
SheetHeader.displayName = "SheetHeader";

const SheetFooter = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
});
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<HTMLHeadingElement, SheetPrimitive.Title.Props>(({ className, ...props }, ref) => {
  return <SheetPrimitive.Title ref={ref} data-slot="sheet-title" className={cn("text-foreground font-semibold", className)} {...props} />;
});
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<HTMLParagraphElement, SheetPrimitive.Description.Props>(({ className, ...props }, ref) => {
  return (
    <SheetPrimitive.Description
      ref={ref}
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
});
SheetDescription.displayName = "SheetDescription";

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
