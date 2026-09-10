import { create } from "@bufbuild/protobuf";
import type L from "leaflet";
import { CrosshairIcon, MinusIcon, PlusIcon } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { getLocationDisplayText } from "@/components/MemoMetadata/Location/locationHelpers";
import { MEMO_PANEL_INSET, MEMO_PANEL_WIDTH_CSS, MemoPanel, MemoPanelList, type MemoPanelSize } from "@/components/MemoPanel";
import { createMemoNavigationState } from "@/components/MemoView/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { LocationSchema } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { fitMemos, MapCanvas } from "./MapCanvas";
import { locationKey, type MapViewport, readViewport, splitLabel } from "./model";
import { useMapMemos } from "./useMapMemos";

/** Enough map beside the card to keep a selection visible. */
const RESERVED_BESIDE_PANEL = 160;

export function MapView() {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const routeRef = useRef(location);
  routeRef.current = location;
  const desktop = useMediaQuery("md");
  const { selectedSpaceName } = useSpaceContext();
  const user = useCurrentUser();
  const { filters, removeFilter } = useMemoFilterContext();
  const query = useMapMemos();
  const mapRef = useRef<L.Map | null>(null);
  const [panelSize, setPanelSize] = useState<MemoPanelSize>({ width: 0, height: 0 });
  // Only a real change may re-render the map tree.
  const onPanelSize = useCallback(
    (next: MemoPanelSize) =>
      setPanelSize((prev) => {
        const width = Math.round(next.width);
        const height = Math.round(next.height);
        return prev.width === width && prev.height === height ? prev : { width, height };
      }),
    [],
  );
  const [tileError, setTileError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);
  const viewport = readViewport(location.search);
  // Selection is keyed by its joined names so panning, which rewrites the search, leaves it identity-stable.
  const selectedKey = new URLSearchParams(location.search).getAll("memo").join("|");
  const selected = useMemo(() => (selectedKey ? selectedKey.split("|") : []), [selectedKey]);
  const selectedMemos = useMemo(() => {
    const names = new Set(selected);
    return query.memos.filter((memo) => names.has(memo.name));
  }, [query.memos, selected]);
  const singlePoint =
    selectedMemos.length > 0 && selectedMemos.every((memo) => locationKey(memo.location!) === locationKey(selectedMemos[0].location!))
      ? selectedMemos[0].location
      : undefined;
  const open = selected.length > 0;

  const updateQuery = useCallback(
    (change: (params: URLSearchParams) => void, replace = false) => {
      const current = routeRef.current;
      const next = new URLSearchParams(current.search);
      change(next);
      const search = next.toString();
      if (search !== current.search.replace(/^\?/, "")) {
        const nextLocation = { ...current, search: search ? `?${search}` : "" };
        routeRef.current = nextLocation;
        navigate({ pathname: current.pathname, search, hash: current.hash }, { replace, state: current.state });
      }
    },
    [navigate],
  );
  const onMove = useCallback(
    (next: MapViewport) =>
      updateQuery((search) => {
        search.set("lat", next.lat.toFixed(6));
        search.set("lng", next.lng.toFixed(6));
        search.set("zoom", String(next.zoom));
      }, true),
    [updateQuery],
  );
  const onReady = useCallback((map: L.Map | null) => {
    mapRef.current = map;
  }, []);
  const onSelect = (names: string[]) => {
    if (saving) return;
    updateQuery((search) => {
      search.delete("memo");
      names.forEach((name) => search.append("memo", name));
    });
  };
  const clearSelection = () => {
    if (saving) return;
    updateQuery((search) => search.delete("memo"));
  };
  // Do not remove a deep-linked selection until all pages have arrived.
  useEffect(() => {
    if (!query.complete || !selected.length) return;
    const available = new Set(query.memos.map((memo) => memo.name));
    if (selected.some((name) => !available.has(name))) {
      updateQuery((search) => {
        const keep = search.getAll("memo").filter((name) => available.has(name));
        search.delete("memo");
        keep.forEach((name) => search.append("memo", name));
      }, true);
    }
  }, [query.complete, query.memos, selected, updateQuery]);
  const composeLocation = useMemo(
    () =>
      singlePoint
        ? create(LocationSchema, {
            latitude: singlePoint.latitude,
            longitude: singlePoint.longitude,
            placeholder: getLocationDisplayText(singlePoint),
          })
        : undefined,
    [singlePoint],
  );
  const afterSave = async (name: string) => {
    setSaving(false);
    const result = await query.refetch();
    if (result.data?.pages.some((page) => page.memos.some((memo) => memo.name === name && memo.location))) {
      updateQuery((search) => search.set("memo", name));
    } else
      toast(
        (toastState) => (
          <span>
            {t(result.isError ? "map.load-error" : "map.saved-outside-filter")}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                toast.dismiss(toastState.id);
                navigate(`/${name}`, { state: createMemoNavigationState(`${location.pathname}${location.search}`) });
              }}
            >
              {t("map.open-memo")}
            </button>
          </span>
        ),
        { duration: 8000 },
      );
  };
  const heading = singlePoint ? splitLabel(getLocationDisplayText(singlePoint)) : { title: t("map.selection") };
  // Floating surfaces let the basemap show through, the way Notion's and Linear's overlays do.
  const surfaceClass = "rounded-lg border border-border/60 bg-background/85 shadow-xs backdrop-blur-md";
  // The calendar's 28px quiet square, a touch more on phones.
  const toolClass = cn(buttonVariants({ variant: "quiet", size: "icon-compact" }), "size-8 md:size-7");

  return (
    <section
      className="relative isolate min-h-0 w-full flex-1 overflow-clip [&_.leaflet-bottom]:bottom-[var(--map-inset-bottom)]! [&_.leaflet-right]:right-[var(--map-inset-end)]! [&_.leaflet-bottom]:transition-[bottom] [&_.leaflet-right]:transition-[right] [&_.leaflet-bottom]:duration-200 [&_.leaflet-right]:duration-200"
      style={
        {
          // Controls and attribution keep clear of the panel: above a bottom sheet, beside a side rail.
          "--map-inset-bottom": !desktop && open ? `${panelSize.height}px` : "0px",
          "--map-inset-end": desktop && open ? `calc(${MEMO_PANEL_WIDTH_CSS} + ${MEMO_PANEL_INSET}px)` : "0px",
        } as CSSProperties
      }
      data-map-page
    >
      <MapCanvas
        memos={query.memos}
        selected={selected}
        viewport={viewport}
        complete={query.complete}
        desktop={desktop}
        panelSize={panelSize}
        onSelect={onSelect}
        // A bare-map click puts the panel away, but never out from under the editor.
        onDismiss={() => !composing && clearSelection()}
        onMove={onMove}
        onReady={onReady}
        onTileError={() => setTileError(true)}
      />
      <h1 className="sr-only">{t("common.map")}</h1>
      {!query.complete && !query.isError && (
        <p
          role="status"
          className={cn(
            "absolute start-3 top-3 z-10 flex h-7 items-center px-2.5 text-xs text-muted-foreground tabular-nums",
            surfaceClass,
          )}
        >
          {t("map.loaded", { count: query.memos.length })}
        </p>
      )}
      {/* Phones pinch and double-tap to zoom, so they get only the fit control, and none while reading a place. */}
      {(desktop || !open) && (
        <div
          role="group"
          aria-label={t("common.map")}
          className={cn("absolute start-3 bottom-3 z-10 flex flex-col items-center p-1", surfaceClass)}
        >
          {desktop && (
            <>
              <button
                type="button"
                className={toolClass}
                aria-label={t("map.zoom-in")}
                title={t("map.zoom-in")}
                onClick={() => mapRef.current?.zoomIn()}
              >
                <PlusIcon strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className={toolClass}
                aria-label={t("map.zoom-out")}
                title={t("map.zoom-out")}
                onClick={() => mapRef.current?.zoomOut()}
              >
                <MinusIcon strokeWidth={1.75} />
              </button>
              <span aria-hidden="true" className="my-1 h-px w-4 bg-border/70" />
            </>
          )}
          <button
            type="button"
            className={toolClass}
            aria-label={t("map.fit-all")}
            title={t("map.fit-all")}
            disabled={query.memos.length === 0}
            onClick={() => {
              if (mapRef.current) fitMemos(mapRef.current, query.memos);
            }}
          >
            <CrosshairIcon strokeWidth={1.75} />
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-3 bottom-8 z-10 flex flex-col items-center gap-2">
        {query.isError && (
          <p role="alert" className={cn("pointer-events-auto px-4 py-2 text-sm", surfaceClass)}>
            {t("map.load-error")}{" "}
            <button type="button" className="ms-2 underline" onClick={() => void query.retry()}>
              {t("search.retry")}
            </button>
          </p>
        )}
        {tileError && (
          <p role="alert" className={cn("pointer-events-auto px-4 py-2 text-sm", surfaceClass)}>
            {t("map.tile-error")}{" "}
            <button
              type="button"
              className="ms-2 underline"
              onClick={() => {
                setTileError(false);
                mapRef.current?.eachLayer((layer) => {
                  if ("redraw" in layer && typeof layer.redraw === "function") layer.redraw();
                });
              }}
            >
              {t("search.retry")}
            </button>
          </p>
        )}
      </div>
      {query.complete && query.memos.length === 0 && !open && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className={cn("pointer-events-auto max-w-sm rounded-xl p-5 text-center", surfaceClass)}>
            <h2 className="font-medium">{t(filters.length ? "map.no-results" : "map.empty")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(filters.length ? "map.no-results-hint" : "map.empty-hint")}</p>
            {filters.length > 0 && (
              <Button className="mt-4" variant="outline" onClick={() => removeFilter(() => true)}>
                {t("map.clear-filters")}
              </Button>
            )}
          </div>
        </div>
      )}
      <MemoPanel
        open={open}
        title={heading.title}
        subtitle={heading.subtitle}
        reservedWidth={RESERVED_BESIDE_PANEL}
        busy={saving}
        onClose={clearSelection}
        onSize={onPanelSize}
      >
        <MemoPanelList
          memos={selectedMemos}
          selectionKey={selectedKey}
          emptyText={t(query.complete ? "map.no-results" : "map.loading")}
          compose={
            composeLocation && {
              cacheKey: `map-editor:${user?.name}:${selectedSpaceName ?? "all"}:${locationKey(composeLocation)}`,
              label: t("map.new-here"),
              defaults: { defaultLocation: composeLocation },
              onComposingChange: setComposing,
              onSavingChange: setSaving,
              onConfirm: (name) => void afterSave(name),
            }
          }
        />
      </MemoPanel>
    </section>
  );
}
