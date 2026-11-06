import { Popover } from "@usememos/ui";
import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { METADATA_ROW_CLASSES, METADATA_ROW_TEXT_CLASSES, MetadataRowIconSlot } from "@/components/MemoMetadata/MetadataSection";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import type { Location } from "@/types/proto/api/memo_service_pb";
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
    <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
      <Popover.Trigger render={<button type="button" title={displayText} className={METADATA_ROW_CLASSES} />}>
        <MetadataRowIconSlot icon={MapPinIcon} />
        <span className={METADATA_ROW_TEXT_CLASSES}>{displayText}</span>
      </Popover.Trigger>
      <Popover.Popup align="start" className="w-80" aria-label={displayText}>
        {popoverOpen && <LazyLocationPicker latlng={{ lat: location.latitude, lng: location.longitude }} readonly className="h-52" />}
        <div className="space-y-1">
          {location.placeholder.trim() && <p className="wrap-anywhere mu-label">{displayText}</p>}
          <p className="mu-caption tabular-nums text-mu-ink-muted">{getLocationCoordinatesText(location, 6)}</p>
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
};

export default LocationDisplayView;
