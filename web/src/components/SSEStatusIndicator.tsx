import { useSSEConnectionStatus } from "@/hooks/useLiveMemoRefresh";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/**
 * A small colored dot that indicates the SSE live-refresh connection status.
 * - Green = connected (live updates active)
 * - Yellow/pulsing = connecting
 * - Red = disconnected (updates not live)
 */
const SSEStatusIndicator = () => {
  const status = useSSEConnectionStatus();

  const label =
    status === "connected" ? "Live updates active" : status === "connecting" ? "Connecting to live updates..." : "Live updates unavailable";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center size-5 cursor-default" aria-label={label}>
          <span
            className={cn(
              "block size-2 rounded-full transition-colors",
              status === "connected" && "bg-green-500",
              status === "connecting" && "bg-yellow-500 animate-pulse",
              status === "disconnected" && "bg-red-500",
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export default SSEStatusIndicator;
