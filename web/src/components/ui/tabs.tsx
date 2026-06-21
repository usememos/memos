import { cva } from "class-variance-authority";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

type TabsVariant = "segmented" | "underline";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: TabsVariant;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs.* components must be rendered within <Tabs>");
  }
  return context;
};

const tabsListVariants = cva("flex flex-row", {
  variants: {
    variant: {
      segmented: "gap-1",
      underline: "gap-1",
    },
  },
  defaultVariants: { variant: "segmented" },
});

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        segmented: "rounded-md px-3 py-1.5",
        underline: "rounded-t-lg rounded-b-none border-b-2 px-3 py-2",
      },
      active: { true: "", false: "" },
    },
    compoundVariants: [
      { variant: "segmented", active: true, className: "bg-background text-foreground shadow-sm" },
      { variant: "segmented", active: false, className: "text-muted-foreground hover:bg-background/50 hover:text-foreground" },
      { variant: "underline", active: true, className: "border-primary bg-primary/5 text-primary" },
      {
        variant: "underline",
        active: false,
        className: "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      },
    ],
    defaultVariants: { variant: "segmented", active: false },
  },
);

interface TabsProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  variant?: TabsVariant;
}

function Tabs({ value, onValueChange, variant = "segmented", children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange, variant }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  const { variant } = useTabsContext();
  return <div role="tablist" className={cn(tabsListVariants({ variant }), className)} {...props} />;
}

interface TabsTriggerProps extends Omit<React.ComponentProps<"button">, "value"> {
  value: string;
}

function TabsTrigger({ value, className, onClick, ...props }: TabsTriggerProps) {
  const { value: activeValue, onValueChange, variant } = useTabsContext();
  const active = activeValue === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={(event) => {
        onValueChange(value);
        onClick?.(event);
      }}
      className={cn(tabsTriggerVariants({ variant, active }), className)}
      {...props}
    />
  );
}

export type { TabsVariant };
export { Tabs, TabsList, TabsTrigger, tabsListVariants, tabsTriggerVariants };
