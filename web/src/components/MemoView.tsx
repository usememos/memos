import { BookmarkIcon, EyeOffIcon, MessageCircleMoreIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { memo, useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { memoStore, userStore, workspaceStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { Memo, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import { isSuperUser } from "@/utils/user";
import MemoActionMenu from "./MemoActionMenu";
import MemoAttachmentListView from "./MemoAttachmentListView";
import MemoContent from "./MemoContent";
import MemoEditor from "./MemoEditor";
import MemoLocationView from "./MemoLocationView";
import MemoReactionistView from "./MemoReactionListView";
import MemoRelationListView from "./MemoRelationListView";
import PreviewImageDialog from "./PreviewImageDialog";
import ReactionSelector from "./ReactionSelector";
import UserAvatar from "./UserAvatar";
import VisibilityIcon from "./VisibilityIcon";

interface Props {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showNsfwContent?: boolean;
  className?: string;
  parentPage?: string;
}

const MemoView: React.FC<Props> = observer((props: Props) => {
  const { memo, className } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const user = useCurrentUser();
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [creator, setCreator] = useState(userStore.getUserByName(memo.creator));
  const [showNSFWContent, setShowNSFWContent] = useState(props.showNsfwContent);
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });
  const workspaceMemoRelatedSetting = workspaceStore.state.memoRelatedSetting;
  const referencedMemos = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const commentAmount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name,
  ).length;
  const relativeTimeFormat = Date.now() - memo.displayTime!.getTime() > 1000 * 60 * 60 * 24 ? "datetime" : "auto";
  const isArchived = memo.state === State.ARCHIVED;
  const readonly = memo.creator !== user?.name && !isSuperUser(user);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);
  const parentPage = props.parentPage || location.pathname;
  const nsfw =
    workspaceMemoRelatedSetting.enableBlurNsfwContent &&
    memo.tags?.some((tag) => workspaceMemoRelatedSetting.nsfwTags.some((nsfwTag) => tag === nsfwTag || tag.startsWith(`${nsfwTag}/`)));

  // Initial related data: creator.
  useAsyncEffect(async () => {
    const user = await userStore.getOrFetchUserByName(memo.creator);
    setCreator(user);
  }, []);

  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memo.name}`, {
      state: {
        from: parentPage,
      },
    });
  }, [memo.name, parentPage]);

  const handleMemoContentClick = useCallback(async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.tagName === "IMG") {
      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        setPreviewImage({ open: true, urls: [imgUrl], index: 0 });
      }
    }
  }, []);

  const handleMemoContentDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (readonly) {
      return;
    }

    if (workspaceMemoRelatedSetting.enableDoubleClickEdit) {
      e.preventDefault();
      setShowEditor(true);
    }
  }, []);

  const onEditorConfirm = () => {
    setShowEditor(false);
    userStore.setStatsStateId();
  };

  const onPinIconClick = async () => {
    if (memo.pinned) {
      await memoStore.updateMemo(
        {
          name: memo.name,
          pinned: false,
        },
        ["pinned"],
      );
    }
  };

  const displayTime = isArchived ? (
    memo.displayTime?.toLocaleString()
  ) : (
    <relative-time datetime={memo.displayTime?.toISOString()} format={relativeTimeFormat}></relative-time>
  );

  return showEditor ? (
    <MemoEditor
      autoFocus
      className="mb-2"
      cacheKey={`inline-memo-editor-${memo.name}`}
      memoName={memo.name}
      onConfirm={onEditorConfirm}
      onCancel={() => setShowEditor(false)}
    />
  ) : (
    <div
      className={cn(
        "relative group flex flex-col justify-start items-start bg-card w-full px-4 py-3 mb-2 gap-2 text-card-foreground rounded-lg border border-border transition-colors",
        className,
      )}
    >
      <div className="w-full flex flex-row justify-between items-center gap-2">
        <div className="w-auto max-w-[calc(100%-8rem)] grow flex flex-row justify-start items-center">
          {props.showCreator && creator ? (
            <div className="w-full flex flex-row justify-start items-center">
              <Link
                className="w-auto hover:opacity-80 rounded-md transition-colors"
                to={`/u/${encodeURIComponent(creator.username)}`}
                viewTransition
              >
                <UserAvatar className="mr-2 shrink-0" avatarUrl={creator.avatarUrl} />
              </Link>
              <div className="w-full flex flex-col justify-center items-start">
                <Link
                  className="block leading-tight hover:opacity-80 rounded-md transition-colors truncate text-muted-foreground"
                  to={`/u/${encodeURIComponent(creator.username)}`}
                  viewTransition
                >
                  {creator.displayName || creator.username}
                </Link>
                <div
                  className="w-auto -mt-0.5 text-xs leading-tight text-muted-foreground select-none cursor-pointer hover:opacity-80 transition-colors"
                  onClick={handleGotoMemoDetailPage}
                >
                  {displayTime}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-full text-sm leading-tight text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors"
              onClick={handleGotoMemoDetailPage}
            >
              {displayTime}
            </div>
          )}
        </div>
        <div className="flex flex-row justify-end items-center select-none shrink-0 gap-2">
          {currentUser && !isArchived && (
            <ReactionSelector
              className={cn("border-none w-auto h-auto", reactionSelectorOpen && "!block", "hidden group-hover:block")}
              memo={memo}
              onOpenChange={setReactionSelectorOpen}
            />
          )}
          {!isInMemoDetailPage && (
            <Link
              className="flex flex-row justify-start items-center rounded-md p-1 hover:opacity-80"
              to={`/${memo.name}#comments`}
              viewTransition
              state={{
                from: parentPage,
              }}
            >
              <MessageCircleMoreIcon className="w-4 h-4 mx-auto text-muted-foreground" />
              {commentAmount > 0 && <span className="text-xs text-muted-foreground">{commentAmount}</span>}
            </Link>
          )}
          {props.showVisibility && memo.visibility !== Visibility.PRIVATE && (
            <Tooltip>
              <TooltipTrigger>
                <span className="flex justify-center items-center rounded-md hover:opacity-80">
                  <VisibilityIcon visibility={memo.visibility} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as any)}</TooltipContent>
            </Tooltip>
          )}
          {props.showPinned && memo.pinned && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-pointer">
                    <BookmarkIcon className="w-4 h-auto text-primary" onClick={onPinIconClick} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("common.unpin")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {nsfw && showNSFWContent && (
            <span className="cursor-pointer">
              <EyeOffIcon className="w-4 h-auto text-primary" onClick={() => setShowNSFWContent(false)} />
            </span>
          )}
          <MemoActionMenu memo={memo} readonly={readonly} onEdit={() => setShowEditor(true)} />
        </div>
      </div>
      <div
        className={cn(
          "w-full flex flex-col justify-start items-start gap-2",
          nsfw && !showNSFWContent && "blur-lg transition-all duration-200",
        )}
      >
        <MemoContent
          key={`${memo.name}-${memo.updateTime}`}
          memoName={memo.name}
          content={memo.content}
          readonly={readonly}
          onClick={handleMemoContentClick}
          onDoubleClick={handleMemoContentDoubleClick}
          compact={memo.pinned ? false : props.compact} // Always show full content when pinned.
          parentPage={parentPage}
        />
        {memo.location && <MemoLocationView location={memo.location} />}
        <MemoAttachmentListView attachments={memo.attachments} />
        <MemoRelationListView memo={memo} relations={referencedMemos} parentPage={parentPage} />
        <MemoReactionistView memo={memo} reactions={memo.reactions} />
      </div>
      {nsfw && !showNSFWContent && (
        <>
          <div className="absolute inset-0 bg-transparent" />
          <button
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 py-2 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent border border-border rounded-lg bg-card transition-colors"
            onClick={() => setShowNSFWContent(true)}
          >
            {t("memo.click-to-show-nsfw-content")}
          </button>
        </>
      )}

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </div>
  );
});

export default memo(MemoView);
