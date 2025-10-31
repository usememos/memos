import { MapPinIcon, XIcon } from "lucide-react";
import { Location } from "@/types/proto/api/v1/memo_service";

interface Props {
  location?: Location;
  onRemove: () => void;
}

const LocationView = (props: Props) => {
  if (!props.location) {
    return null;
  }

  return (
    <div className="w-full flex flex-row flex-wrap gap-2 mt-2">
      <div className="group relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background text-secondary-foreground text-xs transition-colors hover:bg-accent">
        <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate max-w-[160px]">{props.location.placeholder}</span>
        <button
          className="shrink-0 rounded hover:bg-accent transition-colors p-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onRemove();
          }}
        >
          <XIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  );
};

export default LocationView;
