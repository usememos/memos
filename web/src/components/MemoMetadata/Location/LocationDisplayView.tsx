import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      <PopoverTrigger asChild>
        <button
          type="button"
          title={displayText}
          className="inline-flex max-w-full min-w-0 items-center gap-1 h-7 px-2 rounded-md border border-border bg-background text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground"
        >
          <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-nowrap opacity-80">[{getLocationCoordinatesText(location, 2)}]</span>
          <span className="min-w-0 truncate">{displayText}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="min-w-80 sm:w-lg flex flex-col justify-start items-start">
          {popoverOpen && <LazyLocationPicker latlng={{ lat: location.latitude, lng: location.longitude }} readonly={true} />}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationDisplayView;
