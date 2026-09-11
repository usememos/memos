import { useMemo } from "react";
import { useNearViewport } from "@/hooks/useNearViewport";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Location, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { AttachmentRows } from "./Attachment/AttachmentListView";
import LocationDisplayView from "./Location/LocationDisplayView";
import { METADATA_ROW_LIST_CLASSES } from "./MetadataSection";
import RelationRows, { getRelationRowItems } from "./Relation/RelationRows";

interface MemoMetadataRowsProps {
  audio: Attachment[];
  docs: Attachment[];
  relations: MemoRelation[];
  currentMemoName: string;
  parentPage?: string;
  location?: Location;
}

/**
 * Everything attached to a memo that is not its content or media, as one list of 28px
 * rows 2px apart: audio, files, related memos, and the location. Renders nothing when
 * the memo has none of them, so the body never carries an empty list.
 */
const MemoMetadataRows = ({ audio, docs, relations, currentMemoName, parentPage, location }: MemoMetadataRowsProps) => {
  const { ref: viewportRef, isNearViewport } = useNearViewport<HTMLDivElement>();
  const relationItems = useMemo(() => getRelationRowItems(relations, currentMemoName), [relations, currentMemoName]);

  if (audio.length === 0 && docs.length === 0 && relationItems.length === 0 && !location) {
    return null;
  }

  return (
    <div ref={viewportRef} className={METADATA_ROW_LIST_CLASSES}>
      <AttachmentRows audio={audio} docs={docs} />
      {relationItems.length > 0 && <RelationRows items={relationItems} parentPage={parentPage} enabled={isNearViewport} />}
      {location && <LocationDisplayView location={location} />}
    </div>
  );
};

export default MemoMetadataRows;
