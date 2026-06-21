import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import { Button } from "@/components/ui/button";
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
        <Button variant="outline" size="sm">
          <span className="shrink-0 text-muted-foreground">
            <MapPinIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-nowrap opacity-80">[{getLocationCoordinatesText(location, 2)}]</span>
          <span className="text-nowrap truncate">{displayText}</span>
        </Button>
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
