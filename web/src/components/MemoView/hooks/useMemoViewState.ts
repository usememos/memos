import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { instanceStore, memoStore, userStore } from "@/store";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { KEYBOARD_SHORTCUTS, TEXT_INPUT_TYPES } from "../constants";

interface ImagePreviewState {
  open: boolean;
  urls: string[];
  index: number;
}

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  readonly: boolean;
  showEditor: boolean;
  isArchived: boolean;
  onEdit: () => void;
  onArchive: () => Promise<void>;
}

export const useMemoActions = (memo: Memo) => {
  const t = useTranslate();
  const isArchived = memo.state === State.ARCHIVED;

  const archiveMemo = async () => {
    if (isArchived) return;
    try {
      await memoStore.updateMemo({ name: memo.name, state: State.ARCHIVED }, ["state"]);
      toast.success(t("message.archived-successfully"));
      userStore.setStatsStateId();
    } catch (error: unknown) {
      console.error(error);
      const err = error as { details?: string };
      toast.error(err?.details || "Failed to archive memo");
    }
  };

  const unpinMemo = async () => {
    if (!memo.pinned) return;
    await memoStore.updateMemo({ name: memo.name, pinned: false }, ["pinned"]);
  };

  return { archiveMemo, unpinMemo };
};

const isTextInputElement = (element: HTMLElement | null): boolean => {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.includes(element.type as (typeof TEXT_INPUT_TYPES)[number]);
  }
  return false;
};

export const useKeyboardShortcuts = (cardRef: React.RefObject<HTMLDivElement | null>, options: UseKeyboardShortcutsOptions) => {
  const { enabled, readonly, showEditor, isArchived, onEdit, onArchive } = options;

  useEffect(() => {
    if (!enabled || readonly || showEditor || !cardRef.current) return;

    const cardEl = cardRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!cardEl.contains(target) || isTextInputElement(target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === KEYBOARD_SHORTCUTS.EDIT) {
        event.preventDefault();
        onEdit();
      } else if (key === KEYBOARD_SHORTCUTS.ARCHIVE && !isArchived) {
        event.preventDefault();
        onArchive();
      }
    };

    cardEl.addEventListener("keydown", handleKeyDown);
    return () => cardEl.removeEventListener("keydown", handleKeyDown);
  }, [enabled, readonly, showEditor, isArchived, onEdit, onArchive, cardRef]);
};

export const useNsfwContent = (memo: Memo, initialShowNsfw?: boolean) => {
  const [showNSFWContent, setShowNSFWContent] = useState(initialShowNsfw ?? false);
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;

  const nsfw =
    instanceMemoRelatedSetting.enableBlurNsfwContent &&
    memo.tags?.some((tag) => instanceMemoRelatedSetting.nsfwTags.some((nsfwTag) => tag === nsfwTag || tag.startsWith(`${nsfwTag}/`)));

  return {
    nsfw: nsfw ?? false,
    showNSFWContent,
    toggleNsfwVisibility: () => setShowNSFWContent((prev) => !prev),
  };
};

export const useImagePreview = () => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({ open: false, urls: [], index: 0 });

  return {
    previewState,
    openPreview: (url: string) => setPreviewState({ open: true, urls: [url], index: 0 }),
    setPreviewOpen: (open: boolean) => setPreviewState((prev) => ({ ...prev, open })),
  };
};

export const useMemoCreator = (creatorName: string) => {
  const [creator, setCreator] = useState(userStore.getUserByName(creatorName));
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      const user = await userStore.getOrFetchUserByName(creatorName);
      setCreator(user);
    })();
  }, [creatorName]);

  return creator;
};
