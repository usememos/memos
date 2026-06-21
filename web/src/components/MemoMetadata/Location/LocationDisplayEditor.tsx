import { MapPinIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationCoordinatesText, getLocationDisplayText } from "./locationHelpers";

interface LocationDisplayEditorProps {
  location: Location;
  onRemove?: () => void;
  className?: string;
}

const LocationDisplayEditor: FC<LocationDisplayEditorProps> = ({ location, onRemove, className }) => {
  const displayText = getLocationDisplayText(location);

  return (
    <div
      className={cn(
        "relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-border bg-muted/20 hover:bg-accent/20 transition-all w-full",
        className,
      )}
    >
      <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />

      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-xs truncate" title={displayText}>
          {displayText}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{getLocationCoordinatesText(location)}</span>
      </div>

      {onRemove && (
        <Button variant="ghost" size="icon-sm" onClick={onRemove} title="Remove" aria-label="Remove location">
          <XIcon className="w-3 h-3 text-muted-foreground hover:text-destructive" />
        </Button>
      )}
    </div>
  );
};

export default LocationDisplayEditor;
