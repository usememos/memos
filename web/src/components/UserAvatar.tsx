import { UserRoundIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface Props {
  avatarUrl?: string;
  className?: string;
  name?: string;
}

const UserAvatar = (props: Props) => {
  const { avatarUrl, className, name } = props;
  const title = name?.trim();
  let hash = 0;
  for (const character of title?.toLowerCase() ?? "") hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;
  const style = title && !avatarUrl ? ({ "--avatar-hue": `${((hash >>> 0) % 12) * 30}deg` } as CSSProperties) : undefined;

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        avatarUrl
          ? "border border-border"
          : title
            ? "bg-[oklch(0.82_0.09_var(--avatar-hue))] text-[oklch(0.5_0.1_var(--avatar-hue))] [[data-theme=default-dark]_&]:bg-[oklch(0.42_0.09_var(--avatar-hue))] [[data-theme=default-dark]_&]:text-[oklch(0.85_0.06_var(--avatar-hue))]"
            : "bg-muted text-muted-foreground",
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img className="size-full object-cover" src={avatarUrl} decoding="async" loading="lazy" alt="" />
      ) : (
        // Lower the portrait to crop the body, widen it, and leave a small gap below the head.
        <UserRoundIcon
          className="size-full translate-y-[12.5%] [&_circle]:-translate-y-px [&_path]:origin-center [&_path]:scale-x-110"
          fill="currentColor"
          strokeWidth={0}
        />
      )}
    </div>
  );
};

export default UserAvatar;
