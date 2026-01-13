import { LocationPicker } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useTranslate } from "@/utils/i18n";
import type { LocationDialogProps } from "../types";

export const LocationDialog = ({
  open,
  onOpenChange,
  state,
  locationInitialized: _locationInitialized,
  onPositionChange,
  onUpdateCoordinate,
  onPlaceholderChange,
  onCancel,
  onConfirm,
}: LocationDialogProps) => {
  const t = useTranslate();
  const { placeholder, position, latInput, lngInput } = state;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))] p-0!">
        <VisuallyHidden>
          <DialogClose />
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogTitle>{t("tooltip.select-location")}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>Select a location on the map or enter coordinates manually</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col">
          <div className="w-full h-64 overflow-hidden rounded-t-md bg-muted/30">
            <LocationPicker latlng={position} onChange={onPositionChange} />
          </div>
          <div className="w-full flex flex-col p-3 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="memo-location-lat" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Lat
                </Label>
                <Input
                  id="memo-location-lat"
                  placeholder="Lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latInput}
                  onChange={(e) => onUpdateCoordinate("lat", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="memo-location-lng" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Lng
                </Label>
                <Input
                  id="memo-location-lng"
                  placeholder="Lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={lngInput}
                  onChange={(e) => onUpdateCoordinate("lng", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="memo-location-placeholder" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("tooltip.select-location")}
              </Label>
              <Textarea
                id="memo-location-placeholder"
                placeholder="Choose a position first."
                value={placeholder}
                disabled={!position}
                onChange={(e) => onPlaceholderChange(e.target.value)}
                className="min-h-16"
              />
            </div>
            <div className="w-full flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                {t("common.close")}
              </Button>
              <Button onClick={onConfirm} disabled={!position || placeholder.trim().length === 0}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
