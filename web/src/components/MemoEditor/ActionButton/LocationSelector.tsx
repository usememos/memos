import { LatLng } from "leaflet";
import { MapPinIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LeafletMap from "@/components/LeafletMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Location } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  location?: Location;
  onChange: (location?: Location) => void;
}

interface State {
  initialized: boolean;
  placeholder: string;
  position?: LatLng;
  latInput: string;
  lngInput: string;
}

const LocationSelector = (props: Props) => {
  const t = useTranslate();
  const [state, setState] = useState<State>({
    initialized: false,
    placeholder: props.location?.placeholder || "",
    position: props.location ? new LatLng(props.location.latitude, props.location.longitude) : undefined,
    latInput: props.location ? String(props.location.latitude) : "",
    lngInput: props.location ? String(props.location.longitude) : "",
  });
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

  useEffect(() => {
    setState((state) => ({
      ...state,
      placeholder: props.location?.placeholder || "",
      position: new LatLng(props.location?.latitude || 0, props.location?.longitude || 0),
      latInput: String(props.location?.latitude) || "",
      lngInput: String(props.location?.longitude) || "",
    }));
  }, [props.location]);

  useEffect(() => {
    if (popoverOpen && !props.location) {
      const handleError = (error: any, errorMessage: string) => {
        setState((prev) => ({ ...prev, initialized: true }));
        toast.error(errorMessage);
        console.error(error);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setState((prev) => ({
              ...prev,
              position: new LatLng(lat, lng),
              latInput: String(lat),
              lngInput: String(lng),
              initialized: true,
            }));
          },
          (error) => {
            handleError(error, "Failed to get current position");
          },
        );
      } else {
        handleError("Geolocation is not supported by this browser.", "Geolocation is not supported by this browser.");
      }
    }
  }, [popoverOpen, props.location]);

  useEffect(() => {
    if (!state.position) {
      setState((prev) => ({ ...prev, placeholder: "" }));
      return;
    }

    // Sync lat/lng input values from position
    const newLat = String(state.position.lat);
    const newLng = String(state.position.lng);
    if (state.latInput !== newLat || state.lngInput !== newLng) {
      setState((prev) => ({ ...prev, latInput: newLat, lngInput: newLng }));
    }

    // Fetch reverse geocoding data.
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${state.position.lat}&lon=${state.position.lng}&format=json`)
      .then((response) => response.json())
      .then((data) => {
        if (data && data.display_name) {
          setState((prev) => ({ ...prev, placeholder: data.display_name }));
        }
      })
      .catch((error) => {
        toast.error("Failed to fetch reverse geocoding data");
        console.error("Failed to fetch reverse geocoding data:", error);
      });
  }, [state.position]);

  // Update position when lat/lng inputs change (if valid numbers)
  useEffect(() => {
    const lat = parseFloat(state.latInput);
    const lng = parseFloat(state.lngInput);
    // Validate coordinate ranges: lat must be -90 to 90, lng must be -180 to 180
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (!state.position || state.position.lat !== lat || state.position.lng !== lng) {
        setState((prev) => ({ ...prev, position: new LatLng(lat, lng) }));
      }
    }
  }, [state.latInput, state.lngInput]);

  const onPositionChanged = (position: LatLng) => {
    setState((prev) => ({ ...prev, position }));
  };

  const removeLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    props.onChange(undefined);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size={props.location ? undefined : "icon"}>
                <MapPinIcon className="size-5 shrink-0" />
                {props.location && (
                  <>
                    <span className="ml-0.5 text-sm text-ellipsis whitespace-nowrap overflow-hidden max-w-28">
                      {props.location.placeholder}
                    </span>
                    <span className="ml-1 cursor-pointer hover:text-primary" onClick={removeLocation}>
                      <XIcon className="size-4 shrink-0" />
                    </span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!props.location && (
            <TooltipContent side="bottom">
              <p>{t("tooltip.select-location")}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="center" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex flex-col gap-2 p-0">
          <div className="w-full overflow-hidden bg-muted/30">
            <LeafletMap key={JSON.stringify(state.initialized)} latlng={state.position} onChange={onPositionChanged} />
          </div>
          <div className="w-full space-y-3 px-2 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="memo-location-lat" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lat
                </Label>
                <Input
                  id="memo-location-lat"
                  placeholder="Lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={state.latInput}
                  onChange={(e) => setState((prev) => ({ ...prev, latInput: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="memo-location-lng" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lng
                </Label>
                <Input
                  id="memo-location-lng"
                  placeholder="Lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={state.lngInput}
                  onChange={(e) => setState((prev) => ({ ...prev, lngInput: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="memo-location-placeholder" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("tooltip.select-location")}
              </Label>
              <Textarea
                id="memo-location-placeholder"
                placeholder="Choose a position first."
                value={state.placeholder}
                disabled={!state.position}
                onChange={(e) => setState((prev) => ({ ...prev, placeholder: e.target.value }))}
                className="min-h-16"
              />
            </div>
            <div className="w-full flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPopoverOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
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
                disabled={!state.position || state.placeholder.trim().length === 0}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LocationSelector;
