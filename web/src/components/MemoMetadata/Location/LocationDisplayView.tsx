import { LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { LocationPicker } from "@/components/map";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationCoordinatesText, getLocationDisplayText } from "./locationHelpers";

interface LocationDisplayViewProps {
  location?: Location;
  className?: string;
}

const LocationDisplayView = ({ location, className }: LocationDisplayViewProps) => {
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
          className={cn(
            "w-full flex flex-row gap-2 cursor-pointer",
            "relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-muted/20 hover:bg-accent/20 text-muted-foreground hover:text-foreground text-xs transition-colors",
            className,
          )}
        >
          <span className="shrink-0 text-muted-foreground">
            <MapPinIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-nowrap opacity-80">[{getLocationCoordinatesText(location, 2)}]</span>
          <span className="text-nowrap truncate">{displayText}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="min-w-80 sm:w-lg flex flex-col justify-start items-start">
          <LocationPicker latlng={new LatLng(location.latitude, location.longitude)} readonly={true} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationDisplayView;
