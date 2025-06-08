import { Tooltip } from "@mui/joy";
import type { StatCardProps } from "@/types/statistics";
import { cn } from "@/utils";

export const StatCard = ({ icon, label, count, onClick, tooltip, className }: StatCardProps) => {
  const content = (
    <div
      className={cn(
        "w-auto border border-zinc-200 dark:border-zinc-800 pl-1.5 pr-2 py-0.5 rounded-md flex justify-between items-center",
        "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors",
        className,
      )}
      onClick={onClick}
    >
      <div className="w-auto flex justify-start items-center mr-1">
        {icon}
        <span className="block text-sm opacity-80">{label}</span>
      </div>
      <span className="text-sm truncate opacity-80">{count}</span>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} placement="top" arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
};
