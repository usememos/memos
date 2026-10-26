import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "./focus";

type TabsVariant = "segmented" | "underline";
type TabsSize = "default" | "sm";

interface TabsContextValue {
  value: string;
  variant: TabsVariant;
  size: TabsSize;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tabs.* components must be rendered within <Tabs>");
  return context;
};

const tabsListVariants = cva("flex flex-row items-center gap-0.5", {
  variants: {
    variant: {
      segmented: "rounded-lg bg-muted/60 p-0.5",
      underline: "",
    },
  },
  defaultVariants: { variant: "segmented" },
});

const tabsTriggerVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-150 cursor-pointer data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:shrink-0 motion-reduce:transition-none",
    FOCUS_VISIBLE_OUTLINE_CLASSES,
  ),
  {
    variants: {
      variant: {
        segmented: "rounded-md",
        underline: "-mb-px rounded-t-md border-b-2",
      },
      size: {
        default: "h-8 px-3 text-sm",
        sm: "h-7 px-2 text-ui",
      },
      active: { true: "", false: "" },
    },
    compoundVariants: [
      { variant: "segmented", active: true, className: "bg-popover text-popover-foreground shadow-xs" },
      { variant: "segmented", active: false, className: "text-muted-foreground hover:bg-background/50 hover:text-foreground" },
      { variant: "underline", active: true, className: "border-primary text-foreground" },
      {
        variant: "underline",
        active: false,
        className: "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      },
    ],
    defaultVariants: { variant: "segmented", size: "default", active: false },
  },
);

interface TabsProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
}

function Tabs({ value, onValueChange, variant = "segmented", size = "default", children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, variant, size }}>
      <TabsPrimitive.Root value={value} onValueChange={(next) => typeof next === "string" && onValueChange(next)} {...props}>
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

function TabsList({ className, activateOnFocus = true, ...props }: Omit<TabsPrimitive.List.Props, "className"> & { className?: string }) {
  const { variant } = useTabsContext();
  return <TabsPrimitive.List activateOnFocus={activateOnFocus} className={cn(tabsListVariants({ variant }), className)} {...props} />;
}

interface TabsTriggerProps extends Omit<TabsPrimitive.Tab.Props, "className" | "value"> {
  value: string;
  className?: string;
}

function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const { value: activeValue, variant, size } = useTabsContext();
  return (
    <TabsPrimitive.Tab
      value={value}
      className={cn(tabsTriggerVariants({ variant, size, active: activeValue === value }), className)}
      {...props}
    />
  );
}

export type { TabsSize, TabsVariant };
export { Tabs, TabsList, TabsTrigger, tabsListVariants, tabsTriggerVariants };
