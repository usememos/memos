import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogPrimitive.Backdrop.Props>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "fixed inset-0 z-overlay bg-foreground/50 transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const dialogContentVariants = cva(
  "bg-background fixed top-[50%] left-[50%] z-overlay flex max-h-[calc(100vh-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col rounded-lg border shadow-lg transition-[opacity,scale] duration-200 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]",
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
    }
>(({ className, children, showCloseButton = true, size, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      initialFocus={false}
      finalFocus={false}
      {...props}
    >
      <div className="overflow-y-auto overflow-x-hidden flex-1 flex flex-col gap-4">{children}</div>
      {showCloseButton && (
        <DialogPrimitive.Close className="ring-offset-background absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

const DialogHeader = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
));
DialogHeader.displayName = "DialogHeader";

const DialogFooter = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
));
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogPrimitive.Title.Props>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg leading-none font-semibold", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogPrimitive.Description.Props>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />
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
