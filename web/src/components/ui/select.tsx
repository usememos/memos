import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectProps = Omit<SelectPrimitive.Root.Props<string>, "onValueChange"> & {
  onValueChange?: (value: string) => void;
};

// Base UI types the callback value as `string | null`, but none of the app's selects are
// clearable, so the null case is filtered here once instead of at every call site.
function Select({ onValueChange, ...props }: SelectProps) {
  return (
    <SelectPrimitive.Root
      data-slot="select"
      onValueChange={onValueChange && ((value: string | null) => value !== null && onValueChange(value))}
      {...props}
    />
  );
}

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "xs" | "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-border data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex w-fit items-center justify-between rounded-md border bg-transparent text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=default]:gap-2 data-[size=default]:px-2 data-[size=default]:py-1 data-[size=sm]:h-7 data-[size=sm]:gap-2 data-[size=sm]:px-2 data-[size=sm]:py-1 data-[size=xs]:h-6 data-[size=xs]:gap-1 data-[size=xs]:px-1 data-[size=xs]:py-0.5 data-[size=xs]:text-xs *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="size-4 opacity-50" />} />
    </SelectPrimitive.Trigger>
  );
}

type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "align" | "alignItemWithTrigger" | "alignOffset" | "side" | "sideOffset">;

function SelectContent({
  className,
  children,
  align = "start",
  alignItemWithTrigger = false,
  alignOffset,
  side,
  sideOffset = 4,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "bg-popover text-popover-foreground relative z-dropdown max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md transition-[opacity,scale,translate] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-[side=bottom]:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=left]:-translate-x-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=left]:data-ending-style:translate-x-1 data-[side=right]:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 data-[side=right]:data-ending-style:-translate-x-1 data-[side=top]:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=top]:data-ending-style:translate-y-1",
            !alignItemWithTrigger && "w-full min-w-(--anchor-width) scroll-my-1",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1 text-xs select-none", className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="shrink-0 whitespace-nowrap">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span className="absolute right-2 flex size-3.5 items-center justify-center" />}>
        <CheckIcon className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({ className, ...props }: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
