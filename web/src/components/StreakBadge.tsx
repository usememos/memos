import { FlameIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const StreakBadge = ({ currentStreak, longestStreak, className, size = "md", showIcon = true }: StreakBadgeProps) => {
  const t = useTranslate();

  // Don't render if no current streak
  if (currentStreak === 0) {
    return null;
  }

  // Determine milestone level for visual enhancement
  const getMilestoneLevel = (streak: number): "base" | "bronze" | "silver" | "gold" => {
    if (streak >= 100) return "gold";
    if (streak >= 30) return "silver";
    if (streak >= 7) return "bronze";
    return "base";
  };

  const milestoneLevel = getMilestoneLevel(currentStreak);
  const isNewRecord = currentStreak === longestStreak && longestStreak > 0;

  // Size variants
  const sizeClasses = {
    sm: "gap-1 text-xs px-2 py-0.5",
    md: "gap-1.5 text-sm px-2.5 py-1",
    lg: "gap-2 text-base px-3 py-1.5",
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  // Milestone color variants
  const milestoneColors = {
    base: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    bronze: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    silver: "bg-gradient-to-r from-slate-500/15 to-slate-400/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    gold: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold border backdrop-blur-sm transition-all duration-200",
            sizeClasses[size],
            milestoneColors[milestoneLevel],
            milestoneLevel === "gold" && "shadow-sm shadow-yellow-500/20 animate-pulse",
            className,
          )}
        >
          {showIcon && <FlameIcon className={cn(iconSizeClasses[size], "fill-current")} />}
          <span>{currentStreak}</span>
          {isNewRecord && size !== "sm" && <span className="ml-0.5">🏆</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex flex-col gap-1">
        <div className="font-semibold">
          {t("streak.current")}: {currentStreak} {t("streak.days")}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("streak.longest")}: {longestStreak} {t("streak.days")}
        </div>
        {isNewRecord && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">{t("streak.new-record")}</div>
        )}
        {milestoneLevel === "gold" && <div className="text-xs text-yellow-600 dark:text-yellow-400">{t("streak.milestone-100")}</div>}
        {milestoneLevel === "silver" && <div className="text-xs text-slate-600 dark:text-slate-400">{t("streak.milestone-30")}</div>}
        {milestoneLevel === "bronze" && <div className="text-xs text-orange-600 dark:text-orange-400">{t("streak.milestone-7")}</div>}
      </TooltipContent>
    </Tooltip>
  );
};

export default StreakBadge;
