import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { popupMotionClasses } from "./popup";

const DropdownMenu = ({ ...props }: DropdownMenuPrimitive.Root.Props) => {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" modal={false} {...props} />;
};

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

type DropdownMenuSize = "default" | "sm";

const DropdownMenuSizeContext = React.createContext<DropdownMenuSize>("default");

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuPrimitive.Trigger.Props>(({ ...props }, ref) => {
  return <DropdownMenuPrimitive.Trigger ref={ref} data-slot="dropdown-menu-trigger" {...props} />;
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

type DropdownMenuContentProps = DropdownMenuPrimitive.Popup.Props &
  Pick<DropdownMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    size?: DropdownMenuSize;
  };

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align, alignOffset, side, sideOffset = 4, size = "default", ...props }, ref) => {
    return (
      <DropdownMenuSizeContext.Provider value={size}>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Positioner
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={sideOffset}
            className="isolate z-dropdown outline-none"
          >
            <DropdownMenuPrimitive.Popup
              ref={ref}
              data-slot="dropdown-menu-content"
              data-size={size}
              className={cn(
                "bg-popover text-popover-foreground z-dropdown max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto border outline-none",
                size === "sm" ? "min-w-24 rounded p-0.5 shadow-sm" : "min-w-[8rem] rounded-md p-1 shadow-md",
                popupMotionClasses,
                className,
              )}
              {...props}
            />
          </DropdownMenuPrimitive.Positioner>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuSizeContext.Provider>
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

function DropdownMenuGroup({ ...props }: DropdownMenuPrimitive.Group.Props) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: DropdownMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center rounded-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "sm"
          ? "min-h-7 gap-1.5 px-2 py-1 text-ui data-[inset]:pl-7 [&_svg:not([class*='size-'])]:size-3.5"
          : "gap-2 px-2 py-1.5 text-sm data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: DropdownMenuPrimitive.CheckboxItem.Props) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center rounded-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "sm"
          ? "min-h-7 gap-1.5 py-1 pr-2 pl-7 text-ui [&_svg:not([class*='size-'])]:size-3.5"
          : "gap-2 py-1.5 pr-2 pl-8 text-sm [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className={size === "sm" ? "size-3.5" : "size-4"} />
        </DropdownMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: DropdownMenuPrimitive.RadioGroup.Props) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({ className, children, ...props }: DropdownMenuPrimitive.RadioItem.Props) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center rounded-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "sm"
          ? "min-h-7 gap-1.5 py-1 pr-2 pl-7 text-ui [&_svg:not([class*='size-'])]:size-3.5"
          : "gap-2 py-1.5 pr-2 pl-8 text-sm [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.RadioItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: DropdownMenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 font-medium", size === "sm" ? "py-1 text-ui data-[inset]:pl-7" : "py-1.5 text-sm data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: DropdownMenuPrimitive.Separator.Props) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border h-px", size === "sm" ? "-mx-0.5 my-0.5" : "-mx-1 my-1", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("text-muted-foreground ml-auto tracking-widest", size === "sm" ? "text-2xs" : "text-xs", className)}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: DropdownMenuPrimitive.SubmenuRoot.Props) {
  return <DropdownMenuPrimitive.SubmenuRoot {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  const size = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center rounded-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "sm"
          ? "min-h-7 gap-1.5 px-2 py-1 text-ui data-[inset]:pl-7 [&_svg:not([class*='size-'])]:size-3.5"
          : "gap-2 px-2 py-1.5 text-sm data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className={cn("ml-auto", size === "sm" ? "size-3.5" : "size-4")} />
    </DropdownMenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({ className, size, ...props }: DropdownMenuContentProps) {
  const inheritedSize = React.useContext(DropdownMenuSizeContext);

  return (
    <DropdownMenuContent
      align="start"
      alignOffset={-3}
      side="right"
      sideOffset={0}
      size={size ?? inheritedSize}
      className={cn("w-auto", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
