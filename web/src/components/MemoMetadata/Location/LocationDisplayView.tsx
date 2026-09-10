import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationCoordinatesText, getLocationDisplayText } from "./locationHelpers";

interface LocationDisplayViewProps {
  location?: Location;
}

const LocationDisplayView = ({ location }: LocationDisplayViewProps) => {
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  if (!location) {
    return null;
  }

  const displayText = getLocationDisplayText(location);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={displayText}
            className={cn(
              "inline-flex min-h-7 max-w-full min-w-0 items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground data-popup-open:text-foreground",
              FOCUS_VISIBLE_OUTLINE_CLASSES,
            )}
          />
        }
      >
        <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0">
        {popoverOpen && (
          <LazyLocationPicker
            latlng={{ lat: location.latitude, lng: location.longitude }}
            readonly
            className="h-52 rounded-none border-0 shadow-none"
          />
        )}
        <div className="space-y-1 px-3 py-2.5">
          {location.placeholder.trim() && <p className="wrap-anywhere text-sm font-medium">{displayText}</p>}
          <p className="text-xs tabular-nums text-muted-foreground">{getLocationCoordinatesText(location, 6)}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationDisplayView;
