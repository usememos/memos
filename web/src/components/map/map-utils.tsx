import { DivIcon } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useMemo } from "react";
import ReactDOMServer from "react-dom/server";
import { TileLayer } from "react-leaflet";
import { useAuth } from "@/contexts/AuthContext";
import { resolveTheme } from "@/utils/theme";

const TILE_URLS = {
  light: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

export const ThemedTileLayer = () => {
  const { userGeneralSetting } = useAuth();
  const isDark = useMemo(() => resolveTheme(userGeneralSetting?.theme || "system").includes("dark"), [userGeneralSetting?.theme]);
  return <TileLayer url={isDark ? TILE_URLS.dark : TILE_URLS.light} />;
};

interface MarkerIconOptions {
  fill?: string;
  size?: number;
  className?: string;
}

export const createMarkerIcon = (options?: MarkerIconOptions): DivIcon => {
  const { fill = "orange", size = 28, className = "" } = options || {};
  return new DivIcon({
    className: "relative border-none",
    html: ReactDOMServer.renderToString(
      <MapPinIcon className={`absolute bottom-1/2 -left-1/2 ${className}`.trim()} fill={fill} size={size} />,
    ),
  });
};

export const defaultMarkerIcon = createMarkerIcon();
