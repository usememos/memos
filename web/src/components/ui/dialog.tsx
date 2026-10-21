import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

type DialogBackdrop = "default" | "subtle";

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogPrimitive.Backdrop.Props & { tone?: DialogBackdrop }>(
  ({ className, tone = "default", ...props }, ref) => (
    <DialogPrimitive.Backdrop
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-overlay transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
        tone === "subtle" ? "bg-overlay/35" : "bg-overlay/50",
        className,
      )}
      {...props}
    />
  ),
);
DialogOverlay.displayName = "DialogOverlay";

const dialogContentVariants = cva(
  "bg-popover text-popover-foreground fixed top-[50%] left-[50%] z-overlay flex max-h-[calc(100vh-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col rounded-xl border border-border/70 shadow-float motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:ease-out motion-safe:data-starting-style:scale-[0.98] motion-safe:data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.98] motion-safe:data-ending-style:opacity-0 sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]",
  {
    variants: {
      size: {
        sm: "w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] p-4 sm:w-[calc(100%-3rem)] sm:max-w-[calc(100%-3rem)] sm:p-6 md:w-full md:max-w-sm",
        default:
          "w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] p-4 sm:w-[calc(100%-3rem)] sm:max-w-[calc(100%-3rem)] sm:p-6 md:w-full md:max-w-md",
        lg: "w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] p-4 sm:w-[calc(100%-3rem)] sm:max-w-[calc(100%-3rem)] sm:p-6 md:w-full md:max-w-lg",
        xl: "w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] p-4 sm:w-[calc(100%-3rem)] sm:max-w-[calc(100%-3rem)] sm:p-6 md:w-full md:max-w-xl",
        "2xl":
          "w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] p-4 sm:w-[calc(100%-3rem)] sm:max-w-[calc(100%-3rem)] sm:p-6 md:w-full md:max-w-2xl",
        full: "w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] p-4 sm:w-[calc(100%-3rem)] sm:max-w-[calc(100%-3rem)] sm:p-6 md:w-[calc(100%-2rem)] md:max-w-none",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogPrimitive.Popup.Props &
    VariantProps<typeof dialogContentVariants> & {
      showCloseButton?: boolean;
      backdrop?: DialogBackdrop;
    }
>(({ className, children, showCloseButton = true, backdrop = "default", size, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay tone={backdrop} />
    <DialogPrimitive.Popup ref={ref} className={cn(dialogContentVariants({ size }), className)} {...props}>
      <div className="overflow-y-auto overflow-x-hidden flex-1 flex flex-col gap-4">{children}</div>
      {showCloseButton && (
        <DialogPrimitive.Close className={cn(buttonVariants({ variant: "quiet", size: "icon-compact" }), "absolute top-3 end-3")}>
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

const DialogHeader = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1.5 pe-8 text-start", className)} {...props} />
));
DialogHeader.displayName = "DialogHeader";

const DialogFooter = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
));
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogPrimitive.Title.Props>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base leading-6 font-semibold", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogPrimitive.Description.Props>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-muted-foreground text-sm leading-5", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
