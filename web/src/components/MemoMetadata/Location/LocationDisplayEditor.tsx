import { MapPinIcon } from "lucide-react";
import type { FC } from "react";
import {
  METADATA_ROW_BOX_CLASSES,
  METADATA_ROW_TEXT_CLASSES,
  MetadataRowDetail,
  MetadataRowIconSlot,
  MetadataRowRemoveControl,
} from "@/components/MemoMetadata/MetadataSection";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationCoordinatesText, getLocationDisplayText } from "./locationHelpers";

interface LocationDisplayEditorProps {
  location: Location;
  onRemove?: () => void;
}

/** The draft's location as one metadata row; the remove control shows once the row is engaged. */
const LocationDisplayEditor: FC<LocationDisplayEditorProps> = ({ location, onRemove }) => {
  const displayText = getLocationDisplayText(location);

  return (
    <div className={METADATA_ROW_BOX_CLASSES}>
      <MetadataRowIconSlot icon={MapPinIcon} />
      <span className={METADATA_ROW_TEXT_CLASSES} title={displayText}>
        {displayText}
      </span>
      <MetadataRowDetail parts={[getLocationCoordinatesText(location)]} />
      {onRemove && <MetadataRowRemoveControl label="Remove location" onClick={onRemove} />}
    </div>
  );
};

export default LocationDisplayEditor;
