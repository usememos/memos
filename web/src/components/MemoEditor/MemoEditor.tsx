import { Suspense, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoByName, useUpdateMemo } from "@/hooks/useMemoQueries";
import type { MemoSuggestion } from "@/lib/memo-suggestions";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/proto/api/memo_service_pb";
import { lazyWithReload } from "@/utils/lazy";
import { convertVisibilityFromString } from "@/utils/memo";
import { canManageMemo } from "@/utils/user";
import { draftKeyFor, type MemoEditIdentity, migrateLegacyDraft } from "./edit/draftKey";
import { canChooseSpaceFor, initialEditorState } from "./edit/initialState";
import { cacheService } from "./edit/services/cacheService";
import { EditorProvider } from "./edit/state";
import { MemoContentView } from "./view/MemoContentView";

// The editing session is the composer's chrome, uploads, audio and menus: loaded when a
// memo is first edited or composed, so a page of memos does not carry it. Once loaded it
// renders at once, with no suspense, so a host that preloaded it opens without a gap.
type EditSessionComponent = typeof import("./edit/EditSession").EditSession;
let loadedEditSession: EditSessionComponent | undefined;
const loadEditSession = () =>
  import("./edit/EditSession").then((module) => {
    loadedEditSession = module.EditSession;
    return { default: module.EditSession };
  });
const LazyEditSession = lazyWithReload(loadEditSession);

/** Loads the editing session's code ahead of time, for a host that is about to open an editor. */
export const preloadMemoEditing = (): Promise<void> =>
  loadEditSession().then(
    () => undefined,
    () => undefined,
  );

export interface MemoEditorViewProps {
  mode?: "view";
  /** The memo's resource name, such as `memos/abc`. */
  name: string;
  /** The card renders collapsed, so in-memo anchor links open the detail page instead of scrolling. */
  compact?: boolean;
  /** Collection page that rendered the memo, preserved when an inline link opens its detail page. */
  parentPage?: string;
  className?: string;
  contentClassName?: string;
  onClick?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
}

/** What a new memo or comment starts from. */
export interface MemoDraftSeed {
  /** The memo this draft comments on. A comment has no scope, Space or timestamps of its own. */
  parent?: string;
  /**
   * Where a new memo is composed, such as `home`, `global`, `calendar:<date>` or
   * `map:<key>`. Each scope keeps its own draft, per Space.
   */
  scope?: string;
  /** Fixes the new memo's Space; the Space chooser is then off. */
  space?: string;
  /** Seeds the location once; a restored draft wins. */
  location?: Location;
  /**
   * Seeds `createTime` and `updateTime` and shows the timestamp popover. Followed live
   * while the draft is open, for a calendar whose selected day changes.
   */
  createTime?: Date;
}

export interface MemoEditingProps {
  /** A callback can decide whether focus is still appropriate after the draft is restored. */
  autoFocus?: boolean | (() => boolean);
  placeholder?: string;
  /** Context-derived suggestions for a new top-level memo. */
  suggestions?: readonly MemoSuggestion[];
  className?: string;
  /** Inside a card that is the frame already: no background, border or padding of its own outside focus mode. */
  frameless?: boolean;
  /**
   * Marks the instance as hosted: a host (the global composer dialog) presents the
   * editor in the focus-mode layout and owns that frame. The editor mounts straight
   * into focus mode and exits by calling this to dismiss the host.
   */
  onFocusModeExit?: () => void;
  /** Reports inline focus-mode changes, for a host whose layout must let the editor take the viewport. */
  onFocusModeChange?: (isFocusMode: boolean) => void;
  onConfirm?: (memoName: string) => void;
  /** Offers Cancel; without it the session has no way out but saving, as the Home composer. */
  onCancel?: () => void;
  /** Reports save activity so a host can keep itself open mid-transaction. */
  onSavingChange?: (isSaving: boolean) => void;
}

/** Editing an existing memo by name. */
export interface MemoEditorEditProps extends MemoEditingProps {
  mode: "edit";
  name: string;
}

/** Composing a new memo or comment. */
export interface MemoEditorDraftProps extends MemoEditingProps {
  mode?: "edit";
  draft: MemoDraftSeed;
}

export type MemoEditorProps = MemoEditorViewProps | MemoEditorEditProps | MemoEditorDraftProps;

/**
 * A memo, shown or edited. In view mode it reads the memo by name from whatever query
 * already holds it (a list, a comment page, a detail) and shows it read-only; a viewer
 * who can manage the memo ticks its task items, and each tick is saved through the memo
 * mutation, so every copy of the memo on the page follows at once. In edit mode, for an
 * existing memo by name or a new memo from a draft seed, it owns the draft store,
 * initialized once from the memo or the persisted draft, and renders the editing
 * session over it. The parent owns the mode and hears back through `onConfirm` and
 * `onCancel`.
 */
export const MemoEditor = (props: MemoEditorProps) => {
  if ("draft" in props) return <MemoEditorDraft {...props} />;
  if (props.mode === "edit") return <MemoEditorEdit {...props} />;
  return <MemoEditorView {...props} />;
};

const MemoEditorView = ({ name, compact, parentPage, className, contentClassName, onClick, onDoubleClick }: MemoEditorViewProps) => {
  const { data: memo } = useMemoByName(name);
  const currentUser = useCurrentUser();
  const { mutate: updateMemo } = useUpdateMemo();
  if (!memo) return null;

  const handleTaskToggle = (content: string) => updateMemo({ update: { name, content }, updateMask: ["content", "update_time"] });

  return (
    <MemoContentView
      memoName={name}
      content={memo.content}
      attachments={memo.attachments}
      parentPage={parentPage}
      compact={compact}
      onTaskToggle={canManageMemo(memo, currentUser) ? handleTaskToggle : undefined}
      className={className}
      contentClassName={contentClassName}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    />
  );
};

const MemoEditorEdit = ({ name, ...editing }: MemoEditorEditProps) => {
  const { data: memo } = useMemoByName(name);
  // The memo stays readable while the session's code loads, and until the memo itself has.
  const fallback = <MemoEditorView name={name} className={editing.className} />;
  if (!memo) return fallback;
  const identity: MemoEditIdentity = { kind: "edit", name };
  return (
    <Suspense fallback={fallback}>
      <EditingSession key={draftKeyFor(identity)} identity={identity} memo={memo} {...editing} />
    </Suspense>
  );
};

const MemoEditorDraft = ({ draft, ...editing }: MemoEditorDraftProps) => {
  const identity: MemoEditIdentity = draft.parent
    ? { kind: "comment", parent: draft.parent }
    : { kind: "new", scope: draft.scope ?? "default", space: draft.space };
  // While the session's code loads, a still of the empty composer: the same frame, the
  // placeholder line and the toolbar's height, so the page below does not move when the
  // session takes its place.
  const fallback = editing.frameless ? null : (
    <div aria-hidden className={cn("flex w-full flex-col gap-2 rounded-lg border border-border/70 bg-card px-4 py-3", editing.className)}>
      <div className="w-full text-base leading-6 text-muted-foreground">{editing.placeholder ?? " "}</div>
      <div className="h-9 w-full" />
    </div>
  );
  return (
    <Suspense fallback={fallback}>
      <EditingSession
        key={draftKeyFor(identity)}
        identity={identity}
        parentMemoName={draft.parent}
        defaultSpace={draft.space}
        defaultLocation={draft.location}
        defaultCreateTime={draft.createTime}
        {...editing}
      />
    </Suspense>
  );
};

interface EditingSessionProps extends MemoEditingProps {
  identity: MemoEditIdentity;
  memo?: Parameters<typeof initialEditorState>[0]["memo"];
  parentMemoName?: string;
  defaultSpace?: string;
  defaultLocation?: Location;
  defaultCreateTime?: Date;
}

/** One session over one identity: the draft store is created once, so a new identity is a new key. */
const EditingSession = ({
  identity,
  memo,
  parentMemoName,
  defaultSpace,
  defaultLocation,
  defaultCreateTime,
  ...editing
}: EditingSessionProps) => {
  const currentUser = useCurrentUser();
  const { userGeneralSetting } = useAuth();
  const username = currentUser?.name ?? "";
  const draftKey = cacheService.key(username, draftKeyFor(identity));
  const [initialState] = useState(() => {
    migrateLegacyDraft(username, identity);
    return initialEditorState({
      memo,
      draftKey,
      // A hosted editor starts in focus mode and stays there.
      initialFocusMode: Boolean(editing.onFocusModeExit),
      defaultVisibility: userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined,
      defaultCreateTime,
      defaultLocation,
      canChooseSpace: canChooseSpaceFor({ memo, currentUser, parentMemoName, defaultSpace }),
    });
  });
  const EditSession = loadedEditSession ?? LazyEditSession;
  return (
    <EditorProvider initialEditorState={initialState}>
      <EditSession
        memo={memo}
        parentMemoName={parentMemoName}
        defaultSpace={defaultSpace}
        defaultCreateTime={defaultCreateTime}
        draftKey={draftKey}
        {...editing}
      />
    </EditorProvider>
  );
};
