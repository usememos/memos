import { Badge, Popover } from "@usememos/ui";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  /** Full text shown on hover or click, for values the chip truncates. */
  tooltip?: string;
  className?: string;
}

const InfoChip = ({ label, value, tooltip, className }: Props) => {
  const chip = (
    <Badge tone="outline" className={cn("max-w-full", className)}>
      <span className="text-mu-text-secondary">{label}</span>
      <span className="max-w-[20rem] truncate text-mu-text">{value}</span>
    </Badge>
  );

  if (!tooltip) {
    return chip;
  }

  // The full value is something to read, so it opens as a hover card that a click or tap also opens, not a tooltip.
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={300}
        render={
          <button
            type="button"
            className="border border-transparent mu-focus focus-visible:border-mu-focus inline-flex max-w-full rounded-mu-sm"
          />
        }
      >
        {chip}
      </Popover.Trigger>
      <Popover.Popup aria-label={label}>
        <p className="mu-body break-words">{tooltip}</p>
      </Popover.Popup>
    </Popover.Root>
  );
};

export default InfoChip;
