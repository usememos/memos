import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { METADATA_ROW_CLASSES, METADATA_ROW_TEXT_CLASSES, MetadataRowIconSlot } from "@/components/MemoMetadata/MetadataSection";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationCoordinatesText, getLocationDisplayText } from "./locationHelpers";

interface LocationDisplayViewProps {
  location?: Location;
}

/** The memo's location as a metadata row; the row fills while its map is open. */
const LocationDisplayView = ({ location }: LocationDisplayViewProps) => {
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  if (!location) {
    return null;
  }

  const displayText = getLocationDisplayText(location);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger render={<button type="button" title={displayText} className={METADATA_ROW_CLASSES} />}>
        <MetadataRowIconSlot icon={MapPinIcon} />
        <span className={METADATA_ROW_TEXT_CLASSES}>{displayText}</span>
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
          <p className="text-2xs tabular-nums text-muted-foreground">{getLocationCoordinatesText(location, 6)}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationDisplayView;
