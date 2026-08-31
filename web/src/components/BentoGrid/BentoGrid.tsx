import { type ReactNode, useMemo } from "react";
import { type Photo, RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import { GRID_GAP } from "@/components/ColumnGrid";
import { estimateMemoCardHeight } from "@/components/PagedMemoList/memoCardHeight";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { BENTO_ROW_UNIT, BENTO_ROW_UNIT_SMALL, BENTO_SMALL_WIDTH, memoVisualAspect } from "./bentoSpan";

interface BentoGridProps {
  items: Memo[];
  /** Stable identity for each item; also used as the React key. */
  getKey: (item: Memo) => string;
  renderItem: (item: Memo) => ReactNode;
  /** Optional node rendered above the album (e.g. the note composer). */
  leading?: ReactNode;
  /** Key rendered as the first tile, ahead of list order. */
  priorityKey?: string;
  /** Upper bound on photos per row; 0 or undefined means as many as fit. */
  maxColumns?: number;
  /** Unused with the album layout — kept for the shared grid props shape. */
  maxColumnWidth?: number;
}

/** Photo model carrying its memo; width/height encode the tile shape. */
interface BentoPhoto extends Photo {
  memo: Memo;
}

// Text-only tiles get their shape from the card-height estimator, expressed as a
// width/height pair around a nominal 1000px base.
const TEXT_BASE_WIDTH = 1000;

/**
 * Bento layout built on react-photo-album's rows layout: a justified grid where each
 * row is solved from the tiles' aspect ratios, so media shape drives tile shape with
 * no hand-rolled packing. Pinned memos get double width weight as heroes.
 */
const BentoGrid = ({ items, getKey, renderItem, leading, priorityKey, maxColumns }: BentoGridProps) => {
  const photos = useMemo(() => {
    const ordered = [...items];
    if (priorityKey) {
      const priorityIndex = ordered.findIndex((item) => getKey(item) === priorityKey);
      if (priorityIndex > 0) {
        const [priority] = ordered.splice(priorityIndex, 1);
        ordered.unshift(priority);
      }
    }
    return ordered.map<BentoPhoto>((memo) => {
      const aspect = memoVisualAspect(memo);
      // Nominal column width for the estimator fallback; the album rescales anyway.
      const estimatedHeight = estimateMemoCardHeight(memo, { columnWidth: 360 });
      const width = memo.pinned ? TEXT_BASE_WIDTH * 2 : TEXT_BASE_WIDTH;
      const height = aspect ? Math.round(width / aspect) : Math.round(width * (estimatedHeight / 360));
      return { src: "", width, height, memo, key: getKey(memo) };
    });
  }, [items, getKey, priorityKey]);

  return (
    <>
      {leading != null && (
        <div className="mx-auto w-full" style={{ marginBottom: GRID_GAP }}>
          {leading}
        </div>
      )}
      <RowsPhotoAlbum
        photos={photos}
        spacing={GRID_GAP}
        targetRowHeight={(containerWidth) => (containerWidth < BENTO_SMALL_WIDTH ? BENTO_ROW_UNIT_SMALL : BENTO_ROW_UNIT)}
        defaultContainerWidth={800}
        rowConstraints={maxColumns && maxColumns > 0 ? { maxPhotos: maxColumns } : undefined}
        render={{
          photo: (_props, { photo, width, height }) => (
            <div className="relative overflow-hidden rounded-lg [&>*]:absolute [&>*]:inset-0" style={{ width, height }}>
              {renderItem(photo.memo)}
            </div>
          ),
        }}
      />
    </>
  );
};

export default BentoGrid;
