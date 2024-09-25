import { Button, IconButton, Input } from "@mui/joy";
import { LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LeafletMap from "@/components/LeafletMap";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Location } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  location?: Location;
  onChange: (location: Location) => void;
}

interface State {
  placeholder: string;
  position: LatLng;
}

const LocationSelector = (props: Props) => {
  const t = useTranslate();
  const [state, setState] = useState<State>({
    placeholder: props.location?.placeholder || "",
    position: new LatLng(props.location?.latitude || 0, props.location?.longitude || 0),
  });
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  useEffect(() => {
    if (popoverOpen && !props.location) {
      const handleError = (error: any, errorMessage: string) => {
        toast.error(errorMessage);
        console.error(error);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setState({ ...state, position: new LatLng(lat, lng) });
          },
          (error) => {
            handleError(error, "Error getting current position");
          },
        );
      } else {
        handleError("Geolocation is not supported by this browser.", "Geolocation is not supported by this browser.");
      }
    }
  }, [popoverOpen]);

  useEffect(() => {
    // Fetch reverse geocoding data.
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${state.position.lat}&lon=${state.position.lng}&format=json`)
      .then((response) => response.json())
      .then((data) => {
        if (data && data.display_name) {
          setState({ ...state, placeholder: data.display_name });
        }
      })
      .catch((error) => {
        toast.error("Failed to fetch reverse geocoding data");
        console.error("Failed to fetch reverse geocoding data:", error);
      });
  }, [state.position]);

  const onPositionChanged = (position: LatLng) => {
    setState({ ...state, position });
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger>
        <IconButton size="sm" component="div">
          <MapPinIcon className="w-5 h-5 mx-auto shrink-0" />
          {props.location && (
            <span className="font-normal ml-0.5 text-ellipsis whitespace-nowrap overflow-hidden max-w-32">
              {props.location.placeholder}
            </span>
          )}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="center">
        <div className="min-w-80 sm:w-128 flex flex-col justify-start items-start">
          <LeafletMap key={JSON.stringify(state.position)} latlng={state.position} onChange={onPositionChanged} />
          <div className="mt-2 w-full flex flex-row justify-between items-center gap-2">
            <Input
              placeholder="Choose location"
              value={state.placeholder}
              onChange={(e) => setState((state) => ({ ...state, placeholder: e.target.value }))}
            />
            <Button
              size="sm"
              onClick={() => {
                props.onChange(
                  Location.fromPartial({
                    placeholder: state.placeholder,
                    latitude: state.position.lat,
                    longitude: state.position.lng,
                  }),
                );
                setPopoverOpen(false);
              }}
              disabled={!state.position || state.placeholder.length === 0}
            >
              {t("common.add")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationSelector;
