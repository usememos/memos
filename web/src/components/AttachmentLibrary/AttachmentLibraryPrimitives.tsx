import { Badge, buttonClasses, Tooltip } from "@usememos/ui";
import { ExternalLinkIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createMemoNavigationState } from "@/components/MemoView/navigation";
import UserAvatar from "@/components/UserAvatar";
import { extractUsernameFromName } from "@/lib/resource-names";
import { cn } from "@/lib/utils";
import { getCreatorHomePath } from "@/router/routes";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface AttachmentMetadataLineProps {
  className?: string;
  items: Array<string | undefined>;
}

interface AttachmentSourceChipProps {
  memoName?: string;
  unlinkedLabelKey?: "attachment-library.labels.not-linked" | "attachment-library.labels.unused";
}

interface AttachmentOpenButtonProps {
  className?: string;
  href: string;
}

interface AttachmentCreatorProps {
  creatorName?: string;
  user?: User;
}

export const AttachmentCreator = ({ creatorName, user }: AttachmentCreatorProps) => {
  if (!creatorName) return null;

  const username = user?.username || extractUsernameFromName(creatorName);
  const displayName = user?.displayName || username;

  return (
    <Link
      to={getCreatorHomePath(username)}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-mu-sm mu-caption text-mu-ink-muted hover:text-mu-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mu-focus"
      viewTransition
    >
      <UserAvatar className="size-4" avatarUrl={user?.avatarUrl} name={displayName} />
      <span className="truncate">{displayName}</span>
    </Link>
  );
};

export const AttachmentMetadataLine = ({ className, items }: AttachmentMetadataLineProps) => {
  const visibleItems = items.filter((item): item is string => Boolean(item));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto whitespace-nowrap mu-caption text-mu-ink-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {visibleItems.map((item, index) => (
        <span key={`${item}-${index}`} className="contents">
          {index > 0 && <span className="shrink-0 text-mu-ink-muted/50">•</span>}
          <span className="shrink-0">{item}</span>
        </span>
      ))}
    </div>
  );
};

export const AttachmentSourceChip = ({
  memoName,
  unlinkedLabelKey = "attachment-library.labels.not-linked",
}: AttachmentSourceChipProps) => {
  const location = useLocation();
  const t = useTranslate();

  if (!memoName) {
    return <Badge tone="warning">{t(unlinkedLabelKey)}</Badge>;
  }

  return (
    <Link
      to={`/${memoName}`}
      state={createMemoNavigationState(`${location.pathname}${location.search}`)}
      className="inline-flex max-w-full items-center truncate rounded-full border border-mu-line/60 bg-mu-well/30 px-1.5 py-0.5 mu-caption text-mu-ink-muted hover:bg-mu-hover"
    >
      <span className="truncate">{t("attachment-library.labels.memo")}</span>
    </Link>
  );
};

export const AttachmentOpenButton = ({ className, href }: AttachmentOpenButtonProps) => {
  const t = useTranslate();

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonClasses({ variant: "ghost", size: "sm", iconOnly: true }), "shrink-0", className)}
            aria-label={t("attachment-library.actions.open")}
          >
            <ExternalLinkIcon className="mu-icon" />
          </a>
        }
      />
      <Tooltip.Popup>{t("attachment-library.actions.open")}</Tooltip.Popup>
    </Tooltip.Root>
  );
};
