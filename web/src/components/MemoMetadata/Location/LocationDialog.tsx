import { Button, Dialog, Field, Input, Textarea } from "@usememos/ui";
import type { LocationState } from "@/components/MemoEditor/edit/types/insertMenu";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import type { MapPoint } from "@/components/map/types";
import { useTranslate } from "@/utils/i18n";

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LocationState;
  onPositionChange: (position: MapPoint) => void;
  onUpdateCoordinate: (type: "lat" | "lng", value: string) => void;
  onPlaceholderChange: (placeholder: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LocationDialog = ({
  open,
  onOpenChange,
  state,
  onPositionChange,
  onUpdateCoordinate,
  onPlaceholderChange,
  onCancel,
  onConfirm,
}: LocationDialogProps) => {
  const t = useTranslate();
  const { placeholder, position, latInput, lngInput } = state;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup variant="bare" sheet={false} className="w-md">
        <Dialog.Title className="mu-visually-hidden">{t("tooltip.select-location")}</Dialog.Title>
        <Dialog.Description className="mu-visually-hidden">{t("map.location-description")}</Dialog.Description>
        <div className="flex flex-col">
          <div className="w-full h-64 overflow-hidden rounded-t-mu-md bg-mu-well/30">
            {open && <LazyLocationPicker className="h-full" latlng={position} onChange={onPositionChange} />}
          </div>
          <div className="w-full flex flex-col p-3 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field.Root>
                <Field.Label>{t("map.latitude")}</Field.Label>
                <Input
                  id="memo-location-lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latInput}
                  onChange={(e) => onUpdateCoordinate("lat", e.target.value)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>{t("map.longitude")}</Field.Label>
                <Input
                  id="memo-location-lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={lngInput}
                  onChange={(e) => onUpdateCoordinate("lng", e.target.value)}
                />
              </Field.Root>
            </div>
            <Field.Root>
              <Field.Label>{t("tooltip.select-location")}</Field.Label>
              <Textarea
                id="memo-location-placeholder"
                placeholder={t("map.place-placeholder")}
                value={placeholder}
                disabled={!position}
                onChange={(e) => onPlaceholderChange(e.target.value)}
                className="min-h-16"
              />
            </Field.Root>
            <div className="w-full flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                {t("common.close")}
              </Button>
              <Button variant="primary" onClick={onConfirm} disabled={!position || placeholder.trim().length === 0}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
};
