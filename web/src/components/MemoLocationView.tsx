import { LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { Location } from "@/types/proto/api/v1/memo_service";
import LeafletMap from "./LeafletMap";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover";

interface Props {
  location: Location;
}

const MemoLocationView: React.FC<Props> = (props: Props) => {
  const { location } = props;
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <p className="w-full flex flex-row gap-0.5 items-center text-gray-500">
          <MapPinIcon className="w-4 h-auto shrink-0" />
          <span className="text-sm font-normal text-ellipsis whitespace-nowrap overflow-hidden">
            {location.placeholder ? location.placeholder : `[${location.latitude}, ${location.longitude}]`}
          </span>
        </p>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="min-w-80 sm:w-128 flex flex-col justify-start items-start">
          <LeafletMap latlng={new LatLng(location.latitude, location.longitude)} readonly={true} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MemoLocationView;
