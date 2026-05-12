import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import type { MapPoint } from "./types";

interface LazyLocationPickerProps {
  readonly?: boolean;
  latlng?: MapPoint;
  onChange?: (position: MapPoint) => void;
  className?: string;
}

const LocationPicker = lazy(() => import("./LocationPicker"));

export const LazyLocationPicker = ({ className, ...props }: LazyLocationPickerProps) => {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "memo-location-map relative isolate h-72 w-full overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm",
            className,
          )}
        />
      }
    >
      <LocationPicker className={className} {...props} />
    </Suspense>
  );
};
