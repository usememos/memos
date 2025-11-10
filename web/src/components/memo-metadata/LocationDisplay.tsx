import { LatLng } from "leaflet";
import { MapPinIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Location } from "@/types/proto/api/v1/memo_service";
import LeafletMap from "../LeafletMap";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { BaseMetadataProps } from "./types";

interface LocationDisplayProps extends BaseMetadataProps {
  location?: Location;
  onRemove?: () => void;
}

const LocationDisplay = ({ location, mode, onRemove, className }: LocationDisplayProps) => {
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
            "w-full max-w-full flex flex-row gap-2",
            "relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background hover:bg-accent text-secondary-foreground text-xs transition-colors",
            mode === "view" && "cursor-pointer",
            className,
          )}
          onClick={mode === "view" ? () => setPopoverOpen(true) : undefined}
        >
          <span className="shrink-0 text-muted-foreground">
            <MapPinIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-nowrap truncate">{displayText}</span>
          {onRemove && (
            <button
              className="shrink-0 rounded hover:bg-accent transition-colors p-0.5"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
            >
              <XIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
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
