import { timestampDate } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { isEqual } from "lodash-es";
import { BookmarkIcon, FileTextIcon, ImageIcon, LinkIcon, MapPinIcon, MilestoneIcon, Share2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import VisibilitySelector from "@/components/MemoEditor/Toolbar/VisibilitySelector";
import { getLocationDisplayText } from "@/components/MemoMetadata/Location/locationHelpers";
import { getRelationBuckets, getRelationMemo, type RelationDirection } from "@/components/MemoMetadata/Relation/relationHelpers";
import { useResolvedRelationMemos } from "@/components/MemoMetadata/Relation/useResolvedRelationMemos";
import UserAvatar from "@/components/UserAvatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import VisibilityIcon from "@/components/VisibilityIcon";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { useUser } from "@/hooks/useUserQueries";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, MemoRelation, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import { extractHeadings } from "@/utils/markdown-manipulation";
import { convertVisibilityToString } from "@/utils/memo";
import { isSuperUser } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  className?: string;
  onShareImageOpen?: () => void;
}

const SectionLabel = ({ label, count }: { label: string; count?: number }) => (
  <p className="flex items-baseline gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/55">
    {label}
    {count != null && <span className="tabular-nums text-muted-foreground/35">{count}</span>}
  </p>
);

const Section = ({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) => (
  <div className="w-full flex flex-col gap-1.5 border-t border-border/60 pt-3">
    <SectionLabel label={label} count={count} />
    {children}
  </div>
);

/** Quiet icon action for the cluster at the top of the rail. */
const ActionButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md transition-colors",
            active ? "bg-primary/10 text-primary" : "text-muted-foreground/75 hover:bg-accent hover:text-foreground",
          )}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const PropertyLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="min-h-7 flex items-center text-[12.5px] text-muted-foreground/70">{children}</span>
);

const PROPERTY_VALUE_CLASSES = "min-w-0 flex items-center text-[13px] leading-5 text-foreground/85";

const RelationRow = ({ relation, direction, snippet }: { relation: MemoRelation; direction: RelationDirection; snippet: string }) => {
  const relatedMemo = getRelationMemo(relation, direction);
  if (!relatedMemo) {
    return null;
  }
  const Icon = direction === "referencing" ? LinkIcon : MilestoneIcon;
  return (
    <Link
      className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-[13px] leading-5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      to={`/${relatedMemo.name}`}
      title={snippet}
      viewTransition
    >
      <Icon className="size-3.5 shrink-0 opacity-60" />
      <span className="truncate">{snippet}</span>
    </Link>
  );
};

const AttachmentRow = ({ attachment }: { attachment: Attachment }) => {
  const isImage = attachment.type.startsWith("image");
  const Icon = isImage ? ImageIcon : FileTextIcon;
  const size = Number(attachment.size);
  return (
    <a
      className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-[13px] leading-5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      href={getAttachmentUrl(attachment)}
      target="_blank"
      rel="noopener noreferrer"
      title={attachment.filename}
    >
      <Icon className="size-3.5 shrink-0 opacity-60" />
      <span className="truncate">{attachment.filename}</span>
      {size > 0 && <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-muted-foreground/45">{formatFileSize(size)}</span>}
    </a>
  );
};

const MemoDetailSidebar = ({ memo, className, onShareImageOpen }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { profile } = useInstance();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const readonly = memo.creator !== currentUser?.name && !isSuperUser(currentUser);
  const editable = !readonly && memo.state === State.NORMAL;
  const canManageShares = !memo.parent && (memo.creator === currentUser?.name || isSuperUser(currentUser));
  const hasUpdated = !isEqual(memo.createTime, memo.updateTime);

  const { data: creator } = useUser(memo.creator, { enabled: !!memo.creator });
  const headings = useMemo(() => extractHeadings(memo.content), [memo.content]);
  const { referencing, referenced } = useMemo(() => getRelationBuckets(memo.relations, memo.name), [memo.relations, memo.name]);
  const resolvedMemos = useResolvedRelationMemos(memo.relations);

  const createTime = memo.createTime ? timestampDate(memo.createTime) : undefined;
  const updateTime = memo.updateTime ? timestampDate(memo.updateTime) : undefined;
  const formatDate = (date: Date) => date.toLocaleDateString(i18n.language, { year: "numeric", month: "short", day: "numeric" });

  const relationSnippet = (relation: MemoRelation, direction: RelationDirection) => {
    const relatedMemo = getRelationMemo(relation, direction);
    if (!relatedMemo) {
      return "";
    }
    return relatedMemo.snippet || resolvedMemos[relatedMemo.name]?.snippet || relatedMemo.name;
  };

  const handleTogglePin = async () => {
    await updateMemo({ update: { name: memo.name, pinned: !memo.pinned }, updateMask: ["pinned"] });
  };

  const handleVisibilityChange = async (visibility: Visibility) => {
    if (visibility === memo.visibility) {
      return;
    }
    await updateMemo({ update: { name: memo.name, visibility }, updateMask: ["visibility"] });
  };

  const handleCopyLink = () => {
    const host = profile.instanceUrl || window.location.origin;
    copy(`${host}/${memo.name}`);
    toast.success(t("message.succeed-copy-link"));
  };

  return (
    <aside
      className={cn(
        "relative w-full h-auto max-h-screen overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-1.5 select-none",
        className,
      )}
    >
      {/* actions */}
      <div className="flex items-center gap-0.5 -mx-1.5">
        {editable && (
          <ActionButton label={memo.pinned ? t("common.unpin") : t("common.pin")} active={memo.pinned} onClick={handleTogglePin}>
            <BookmarkIcon className={cn("size-[15px]", memo.pinned && "fill-current")} />
          </ActionButton>
        )}
        <ActionButton label={t("memo.copy-link")} onClick={handleCopyLink}>
          <LinkIcon className="size-[15px]" />
        </ActionButton>
        {onShareImageOpen && (
          <ActionButton label={t("memo.share.open-image")} onClick={onShareImageOpen}>
            <ImageIcon className="size-[15px]" />
          </ActionButton>
        )}
        {canManageShares && (
          <ActionButton label={t("memo.share.open-panel")} onClick={() => setSharePanelOpen(true)}>
            <Share2Icon className="size-[15px]" />
          </ActionButton>
        )}
      </div>

      {/* properties */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 border-t border-border/60 pt-3">
        <PropertyLabel>{t("common.visibility")}</PropertyLabel>
        {editable ? (
          <div className="-mx-1.5 min-w-0 justify-self-start">
            <VisibilitySelector size="compact" value={memo.visibility} onChange={handleVisibilityChange} />
          </div>
        ) : (
          <span className={PROPERTY_VALUE_CLASSES}>
            <VisibilityIcon visibility={memo.visibility} className="w-[13px] mr-1.5 shrink-0" />
            <span className="truncate">
              {t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as Parameters<typeof t>[0])}
            </span>
          </span>
        )}

        <PropertyLabel>{t("common.created-at")}</PropertyLabel>
        <span className={cn(PROPERTY_VALUE_CLASSES, "tabular-nums")} title={createTime?.toLocaleString(i18n.language)}>
          {createTime ? formatDate(createTime) : "—"}
        </span>

        {hasUpdated && updateTime && (
          <>
            <PropertyLabel>{t("common.last-updated-at")}</PropertyLabel>
            <span className={cn(PROPERTY_VALUE_CLASSES, "tabular-nums")} title={updateTime.toLocaleString(i18n.language)}>
              {formatDate(updateTime)}
            </span>
          </>
        )}

        {creator && (
          <>
            <PropertyLabel>{t("common.author")}</PropertyLabel>
            <Link
              className={cn(
                PROPERTY_VALUE_CLASSES,
                "gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 justify-self-start hover:bg-accent transition-colors",
              )}
              to={`/u/${encodeURIComponent(creator.username)}`}
              viewTransition
            >
              <UserAvatar className="size-4 shrink-0 rounded-full border-none" avatarUrl={creator.avatarUrl} />
              <span className="truncate">{creator.displayName || creator.username}</span>
            </Link>
          </>
        )}

        {memo.location && (
          <>
            <PropertyLabel>{t("common.location")}</PropertyLabel>
            <span className={PROPERTY_VALUE_CLASSES} title={getLocationDisplayText(memo.location)}>
              <MapPinIcon className="w-[13px] mr-1.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{getLocationDisplayText(memo.location)}</span>
            </span>
          </>
        )}
      </div>

      {memo.tags.length > 0 && (
        <Section label={t("common.tags")} count={memo.tags.length}>
          <div className="flex flex-wrap gap-x-0.5 gap-y-1 -mx-1.5">
            {memo.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex min-w-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[13px] leading-5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <span className="opacity-45">#</span>
                <span className="truncate">{tag}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {memo.attachments.length > 0 && (
        <Section label={t("common.attachments")} count={memo.attachments.length}>
          <div className="flex flex-col">
            {memo.attachments.map((attachment) => (
              <AttachmentRow key={attachment.name} attachment={attachment as Attachment} />
            ))}
          </div>
        </Section>
      )}

      {(referencing.length > 0 || referenced.length > 0) && (
        <Section label={t("common.relations")} count={referencing.length + referenced.length}>
          <div className="flex flex-col">
            {referencing.map((relation) => (
              <RelationRow
                key={`referencing-${getRelationMemo(relation, "referencing")?.name}`}
                relation={relation}
                direction="referencing"
                snippet={relationSnippet(relation, "referencing")}
              />
            ))}
            {referenced.map((relation) => (
              <RelationRow
                key={`referenced-${getRelationMemo(relation, "referenced")?.name}`}
                relation={relation}
                direction="referenced"
                snippet={relationSnippet(relation, "referenced")}
              />
            ))}
          </div>
        </Section>
      )}

      {headings.length > 0 && (
        <Section label={t("memo.outline")}>
          <MemoOutline headings={headings} />
        </Section>
      )}

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </aside>
  );
};

export default MemoDetailSidebar;
