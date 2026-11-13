import { Field, List, Textarea } from "@usememos/ui";
import { createContext, type ReactNode, useContext } from "react";

/** The id of the enclosing SettingGroup's title, so a SettingList inside it is named by that title. */
export const SettingGroupTitleContext = createContext<string | undefined>(undefined);

interface SettingListProps {
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-busy"?: boolean;
}

/** A boxed list of settings or records. Named by the enclosing SettingGroup's title unless a name is given. */
export const SettingList = ({ children, ...props }: SettingListProps) => {
  const groupTitleId = useContext(SettingGroupTitleContext);
  const labelledBy = props["aria-labelledby"] ?? (props["aria-label"] ? undefined : groupTitleId);
  return (
    <List.Root {...props} aria-labelledby={labelledBy}>
      {children}
    </List.Root>
  );
};

interface SettingListItemProps {
  label: ReactNode;
  description?: ReactNode;
  /** The row's one control, placed at the end of the row. */
  children?: ReactNode;
}

/** A settings row: a horizontal Field, so the label and description name the one control at the end. */
export const SettingListItem = ({ label, description, children }: SettingListItemProps) => {
  return (
    <List.Item>
      <Field.Root orientation="horizontal">
        <Field.Label>{label}</Field.Label>
        {description && <Field.Description>{description}</Field.Description>}
        {children}
      </Field.Root>
    </List.Item>
  );
};

export const StatValue = ({ value }: { value: string }) => (
  <span className="block min-w-0 break-all text-right font-mono mu-body tabular-nums text-mu-text">{value}</span>
);

/** A read-only figure: its name at the start, the value at the end. No control, so no Field. */
export const StatRow = ({ label, value }: { label: string; value: string }) => (
  <List.Item className="flex items-baseline justify-between gap-4">
    <span className="min-w-0 mu-body text-mu-text">{label}</span>
    <StatValue value={value} />
  </List.Item>
);

interface SettingPanelProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
}

/**
 * A box around a small form with an optional header and footer row. It is not a List: its rows are a
 * title, a form and a hint rather than settings or records. Padding matches a List row's.
 */
export const SettingPanel = ({ children, header, footer }: SettingPanelProps) => {
  return (
    <div className="rounded-mu-lg border border-mu-line bg-mu-surface">
      {header && <div className="border-b border-mu-line px-4 py-2">{header}</div>}
      <div className="px-4 py-3">{children}</div>
      {footer && <div className="border-t border-mu-line px-4 py-2">{footer}</div>}
    </div>
  );
};

interface SettingCodeEditorProps {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SettingCodeEditor = ({ label, description, value, placeholder, onChange, disabled }: SettingCodeEditorProps) => {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Field.Description>{description}</Field.Description>
      <Textarea
        className="font-mono"
        rows={4}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field.Root>
  );
};
