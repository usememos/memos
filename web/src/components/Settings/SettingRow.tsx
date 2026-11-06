import { Field } from "@usememos/ui";
import type React from "react";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  vertical?: boolean;
}

/** One setting: its label and description name the single control beside them. */
const SettingRow: React.FC<SettingRowProps> = ({ label, description, children, vertical = false }) => {
  return (
    <Field.Root className={cn("w-full gap-3", !vertical && "sm:flex-row sm:items-center sm:justify-between")}>
      <div className={cn("flex min-w-0 flex-col gap-1", vertical ? "w-full" : "flex-1")}>
        <Field.Label>{label}</Field.Label>
        {description && <Field.Description>{description}</Field.Description>}
      </div>
      <div className={cn("flex min-w-0 items-center", vertical ? "w-full" : "w-full sm:w-auto sm:shrink-0")}>{children}</div>
    </Field.Root>
  );
};

export default SettingRow;
