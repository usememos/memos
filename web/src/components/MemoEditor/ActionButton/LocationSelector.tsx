import { Button, Input } from "@usememos/mui";
import { LatLng } from "leaflet";
import { MapPinIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LeafletMap from "@/components/LeafletMap";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Location } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  location?: Location;
  onChange: (location?: Location) => void;
}

interface State {
  initilized: boolean;
  placeholder: string;
  position?: LatLng;
}

const LocationSelector = (props: Props) => {
  const t = useTranslate();
  const [state, setState] = useState<State>({
    initilized: false,
    placeholder: props.location?.placeholder || "",
    position: props.location ? new LatLng(props.location.latitude, props.location.longitude) : undefined,
  });
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  useEffect(() => {
    setState((state) => ({
      ...state,
      placeholder: props.location?.placeholder || "",
      position: new LatLng(props.location?.latitude || 0, props.location?.longitude || 0),
    }));
  }, [props.location]);

  useEffect(() => {
    if (popoverOpen && !props.location) {
      const handleError = (error: any, errorMessage: string) => {
        setState({ ...state, initilized: true });
        toast.error(errorMessage);
        console.error(error);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setState({ ...state, position: new LatLng(lat, lng), initilized: true });
          },
          (error) => {
            handleError(error, "Failed to get current position");
          },
        );
      } else {
        handleError("Geolocation is not supported by this browser.", "Geolocation is not supported by this browser.");
      }
    }
  }, [popoverOpen]);

  useEffect(() => {
    if (!state.position) {
      setState({ ...state, placeholder: "" });
      return;
    }

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

  const removeLocation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onChange(undefined);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button className="flex items-center justify-center" size="sm" variant="plain">
          <MapPinIcon className="w-5 h-5 mx-auto shrink-0" />
          {props.location && (
            <>
              <span className="ml-0.5 text-sm text-ellipsis whitespace-nowrap overflow-hidden max-w-32">{props.location.placeholder}</span>
              <XIcon className="w-5 h-5 mx-auto shrink-0 hidden group-hover:block opacity-60 hover:opacity-80" onClick={removeLocation} />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center">
        <div className="min-w-80 sm:w-128 flex flex-col justify-start items-start">
          <LeafletMap key={JSON.stringify(state.initilized)} latlng={state.position} onChange={onPositionChanged} />
          <div className="mt-2 w-full flex flex-row justify-between items-center gap-2">
            <div className="flex flex-row items-center justify-start gap-2">
              <Input
                placeholder="Choose a position first."
                value={state.placeholder}
                size="sm"
                startDecorator={
                  state.position && (
                    <span className="text-xs opacity-60">
                      [{state.position.lat.toFixed(2)}, {state.position.lng.toFixed(2)}]
                    </span>
                  )
                }
                disabled={!state.position}
                onChange={(e) => setState((state) => ({ ...state, placeholder: e.target.value }))}
              />
            </div>
            <Button
              className="shrink-0"
              color="primary"
              size="sm"
              onClick={() => {
                props.onChange(
                  Location.fromPartial({
                    placeholder: state.placeholder,
                    latitude: state.position?.lat,
                    longitude: state.position?.lng,
                  }),
                );
                setPopoverOpen(false);
              }}
              disabled={!state.position || state.placeholder.length === 0}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationSelector;
