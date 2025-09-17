import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-foreground/50",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Dialog content variants with improved mobile responsiveness.
 *
 * Mobile behavior:
 * - Mobile phones (< 640px): Uses calc(100% - 2rem) width with better 1rem margin on each side
 * - Small tablets (≥ 640px): Uses calc(100% - 3rem) width with 1.5rem margin on each side
 * - Medium screens and up (≥ 768px): Uses fixed max-widths based on size variant
 *
 * Size variants:
 * - sm: max-w-sm (384px) for compact dialogs
 * - default: max-w-md (448px) for standard dialogs
 * - lg: max-w-lg (512px) for larger forms
 * - xl: max-w-xl (576px) for detailed content
 * - 2xl: max-w-2xl (672px) for wide layouts
 * - full: Takes available width with margins
 */
const dialogContentVariants = cva(
  "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex flex-col translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]",
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
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof dialogContentVariants> & {
      showCloseButton?: boolean;
    }
>(({ className, children, showCloseButton = true, size, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
      }}
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        document.body.style.pointerEvents = "auto";
      }}
      {...props}
    >
      <div className="overflow-y-auto overflow-x-hidden flex-1 flex flex-col gap-4">{children}</div>
      {showCloseButton && (
        <DialogPrimitive.Close className="ring-offset-background data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
));
DialogHeader.displayName = "DialogHeader";

const DialogFooter = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
));
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg leading-none font-semibold", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

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
