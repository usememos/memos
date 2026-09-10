import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoEditor from "@/components/MemoEditor";
import type { MemoEditorProps } from "@/components/MemoEditor/types/components";
import MemoView from "@/components/MemoView";
import type { MemoTimeDisplay } from "@/components/MemoView/types";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useView } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

// The cards' own bottom margin sets the gap; the row's edge lines up with theirs.
const COMPOSE_ROW_CLASS = cn(buttonVariants({ variant: "quiet", size: "sm" }), "self-start");

export interface MemoPanelCompose {
  cacheKey: string;
  /** The quiet row's label, e.g. "New memo on this day". */
  label: string;
  /** What the new memo inherits from the selection: its day, its place. */
  defaults?: Pick<MemoEditorProps, "defaultCreateTime" | "defaultLocation">;
  /** Whether the editor is open in place of the row, for hosts whose own gestures could dismiss it. */
  onComposingChange?: (composing: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  onConfirm?: (memoName: string) => void;
}

export interface MemoPanelListProps {
  memos: Memo[];
  /**
   * Identity of the selection the list shows. A change closes an open composer, so a
   * half-written memo can never silently move to another day or place.
   */
  selectionKey: string;
  timeDisplay?: MemoTimeDisplay;
  /** Shown in place of the cards when there are none; omit to show nothing. */
  emptyText?: string;
  /** Present when a memo can be appended to the selection. */
  compose?: MemoPanelCompose;
}

/**
 * A selection's memos as the ordinary memo cards, so editing, reactions and comments behave
 * exactly as on Home, ending with a quiet "new memo" row that expands into the editor in place,
 * the way journals append at the end of a day.
 */
export function MemoPanelList({ memos, selectionKey, timeDisplay, emptyText, compose }: MemoPanelListProps) {
  const t = useTranslate();
  const { isUserSettingsInitialized } = useAuth();
  const { selectedSpaceName } = useSpaceContext();
  const { compactMode } = useView();
  const [composingFor, setComposingFor] = useState<string>();
  const composing = composingFor === selectionKey;
  const onComposingChange = compose?.onComposingChange;
  useEffect(() => {
    onComposingChange?.(composing);
    return () => onComposingChange?.(false);
  }, [composing, onComposingChange]);

  const contents = useMemo(() => memos.map((memo) => memo.content), [memos]);
  const userNames = useMemo(
    () => Array.from(new Set(memos.flatMap((memo) => memo.reactions.map((reaction) => reaction.creator)))),
    [memos],
  );

  return (
    <NewMemoProvider>
      <MentionResolutionProvider contents={contents} userNames={userNames}>
        {memos.map((memo) => (
          <MemoView
            key={memo.name}
            memo={memo}
            timeDisplay={timeDisplay}
            showVisibility
            showPinned
            showSpace={!selectedSpaceName}
            compact={compactMode}
          />
        ))}
      </MentionResolutionProvider>
      {emptyText && memos.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      {compose &&
        isUserSettingsInitialized &&
        (composing ? (
          <MemoEditor
            cacheKey={compose.cacheKey}
            autoFocus
            placeholder={t("editor.any-thoughts")}
            defaultSpace={selectedSpaceName}
            {...compose.defaults}
            onSavingChange={compose.onSavingChange}
            onConfirm={(name) => {
              setComposingFor(undefined);
              compose.onConfirm?.(name);
            }}
            onCancel={() => setComposingFor(undefined)}
          />
        ) : (
          <button type="button" className={COMPOSE_ROW_CLASS} onClick={() => setComposingFor(selectionKey)}>
            <PlusIcon strokeWidth={1.8} />
            <span>{compose.label}</span>
          </button>
        ))}
    </NewMemoProvider>
  );
}
