import { LatLng } from "leaflet";
import { ExternalLinkIcon, MapPinIcon } from "lucide-react";
import { useState } from "react";
import { Location } from "@/types/proto/api/v1/memo_service";
import LeafletMap from "../LeafletMap";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import MetadataBadge from "./MetadataBadge";
import { BaseMetadataProps } from "./types";

interface LocationDisplayProps extends BaseMetadataProps {
  location?: Location;
  onRemove?: () => void;
  onClick?: () => void;
}

/**
 * Unified Location component for both editor and view modes
 *
 * Editor mode: Shows badge with remove button
 * View mode: Shows badge with popover map on click
 */
const LocationDisplay = ({ location, mode, onRemove, onClick, className }: LocationDisplayProps) => {
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  if (!location) {
    return null;
  }

  const displayText = location.placeholder || `[${location.latitude}, ${location.longitude}]`;

  // Editor mode: Simple badge with remove button
  if (mode === "edit") {
    return (
      <div className="w-full flex flex-row flex-wrap gap-2 mt-2">
        <MetadataBadge icon={<MapPinIcon className="w-3.5 h-3.5" />} onRemove={onRemove} onClick={onClick} className={className}>
          {displayText}
        </MetadataBadge>
      </div>
    );
  }

  // View mode: Badge with popover map
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div className="w-full flex flex-row flex-wrap gap-2">
          <MetadataBadge icon={<MapPinIcon className="w-3.5 h-3.5" />} onClick={() => setPopoverOpen(true)} className={className}>
            <span>{displayText}</span>
            <ExternalLinkIcon className="w-2.5 h-2.5 ml-1 opacity-50" />
          </MetadataBadge>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="min-w-80 sm:w-lg flex flex-col justify-start items-start">
          <LeafletMap latlng={new LatLng(location.latitude, location.longitude)} readonly={true} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationDisplay;
