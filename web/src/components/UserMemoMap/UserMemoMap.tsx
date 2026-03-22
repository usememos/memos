import { timestampDate } from "@bufbuild/protobuf/wkt";
import L, { DivIcon } from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { ArrowUpRightIcon, MapPinIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Link } from "react-router-dom";
import { defaultMarkerIcon, ThemedTileLayer } from "@/components/map/map-utils";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

interface Props {
  creator: string;
  className?: string;
}

interface ClusterGroup {
  getChildCount(): number;
}

const createClusterCustomIcon = (cluster: ClusterGroup) => {
  return new DivIcon({
    html: `<span class="flex items-center justify-center w-full h-full bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-md border-2 border-background">${cluster.getChildCount()}</span>`,
    className: "custom-marker-cluster",
    iconSize: L.point(32, 32, true),
  });
};

const extractUserIdFromName = (name: string): string => {
  const match = name.match(/users\/(\d+)/);
  return match ? match[1] : "";
};

const MapFitBounds = ({ memos }: { memos: Memo[] }) => {
  const map = useMap();

  useEffect(() => {
    if (memos.length === 0) return;

    const validMemos = memos.filter((m) => m.location);
    if (validMemos.length === 0) return;

    const bounds = L.latLngBounds(validMemos.map((memo) => [memo.location!.latitude, memo.location!.longitude]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [memos, map]);

  return null;
};

const UserMemoMap = ({ creator, className }: Props) => {
  const creatorId = useMemo(() => extractUserIdFromName(creator), [creator]);

  const { data, isLoading } = useInfiniteMemos({
    state: State.NORMAL,
    orderBy: "display_time desc",
    pageSize: 1000,
    filter: `creator_id == ${creatorId}`,
  });

  const memosWithLocation = useMemo(() => data?.pages.flatMap((page) => page.memos).filter((memo) => memo.location) || [], [data]);

  if (isLoading) return null;

  const defaultCenter = { lat: 48.8566, lng: 2.3522 };

  return (
    <div className={cn("relative z-0 w-full h-[380px] rounded-xl overflow-hidden border border-border shadow-sm", className)}>
      {memosWithLocation.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background/70 px-4 py-2 shadow-sm backdrop-blur-sm">
            <MapPinIcon className="h-5 w-5 text-muted-foreground opacity-60" />
            <p className="text-xs font-medium text-muted-foreground">No location data found</p>
          </div>
        </div>
      )}

      <MapContainer center={defaultCenter} zoom={2} className="h-full w-full z-0" scrollWheelZoom attributionControl={false}>
        <ThemedTileLayer />
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={40}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {memosWithLocation.map((memo) => (
            <Marker key={memo.name} position={[memo.location!.latitude, memo.location!.longitude]} icon={defaultMarkerIcon}>
              <Popup closeButton={false} className="w-48!">
                <div className="flex flex-col p-0.5">
                  <div className="flex items-center justify-between border-b border-border pb-1 mb-1">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {memo.displayTime &&
                        timestampDate(memo.displayTime).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                    </span>
                    <Link
                      to={`/memos/${memo.name.split("/").pop()}`}
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:opacity-80"
                    >
                      View
                      <ArrowUpRightIcon className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="line-clamp-3 py-0.5 text-xs font-sans leading-snug text-foreground">{memo.snippet || "No content"}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
        <MapFitBounds memos={memosWithLocation} />
      </MapContainer>
    </div>
  );
};

export default UserMemoMap;
