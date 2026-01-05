import { LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { LocationPicker } from "@/components/map";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";

interface LocationDisplayProps {
  location?: Location;
  className?: string;
}

const LocationDisplay = ({ location, className }: LocationDisplayProps) => {
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  if (!location) {
    return null;
  }

  const displayText = location.placeholder || `Position: [${location.latitude}, ${location.longitude}]`;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "w-auto max-w-full flex flex-row gap-2 cursor-pointer",
            "relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background hover:bg-accent text-secondary-foreground text-xs transition-colors",
            className,
          )}
          onClick={() => setPopoverOpen(true)}
        >
          <span className="shrink-0 text-muted-foreground">
            <MapPinIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-nowrap opacity-80">
            [{location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°]
          </span>
          <span className="text-nowrap truncate">{displayText}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="min-w-80 sm:w-lg flex flex-col justify-start items-start">
          <LocationPicker latlng={new LatLng(location.latitude, location.longitude)} readonly={true} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationDisplay;
