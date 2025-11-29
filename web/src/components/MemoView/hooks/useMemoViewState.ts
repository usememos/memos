import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { instanceStore, memoStore, userStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import type { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { KEYBOARD_SHORTCUTS, TEXT_INPUT_TYPES } from "../constants";
import type {
  ImagePreviewState,
  UseImagePreviewReturn,
  UseKeyboardShortcutsOptions,
  UseMemoActionsReturn,
  UseNsfwContentReturn,
} from "../types";

/**
 * Hook for handling memo actions (archive, unpin)
 */
export const useMemoActions = (memo: Memo): UseMemoActionsReturn => {
  const t = useTranslate();
  const isArchived = memo.state === State.ARCHIVED;

  const archiveMemo = useCallback(async () => {
    if (isArchived) {
      return;
    }

    try {
      await memoStore.updateMemo(
        {
          name: memo.name,
          state: State.ARCHIVED,
        },
        ["state"],
      );
      toast.success(t("message.archived-successfully"));
      userStore.setStatsStateId();
    } catch (error: unknown) {
      console.error(error);
      const err = error as { details?: string };
      toast.error(err?.details || "Failed to archive memo");
    }
  }, [isArchived, memo.name, t]);

  const unpinMemo = useCallback(async () => {
    if (!memo.pinned) {
      return;
    }

    await memoStore.updateMemo(
      {
        name: memo.name,
        pinned: false,
      },
      ["pinned"],
    );
  }, [memo.name, memo.pinned]);

  return { archiveMemo, unpinMemo };
};

/**
 * Hook for handling keyboard shortcuts on the memo card
 */
export const useKeyboardShortcuts = (
  cardRef: React.RefObject<HTMLDivElement | null>,
  options: UseKeyboardShortcutsOptions,
): {
  shortcutActive: boolean;
  handleShortcutActivation: (active: boolean) => void;
} => {
  const { enabled, readonly, showEditor, isArchived, onEdit, onArchive } = options;
  const [shortcutActive, setShortcutActive] = useState(false);

  const isTextInputElement = useCallback((element: HTMLElement | null): boolean => {
    if (!element) return false;
    if (element.isContentEditable) return true;
    if (element instanceof HTMLTextAreaElement) return true;

    if (element instanceof HTMLInputElement) {
      return TEXT_INPUT_TYPES.includes(element.type as (typeof TEXT_INPUT_TYPES)[number]);
    }

    return false;
  }, []);

  useEffect(() => {
    if (!enabled || readonly || showEditor || !cardRef.current) {
      return;
    }

    const cardEl = cardRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!cardEl.contains(target) || isTextInputElement(target)) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

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
  }, [enabled, readonly, showEditor, isArchived, onEdit, onArchive, cardRef, isTextInputElement]);

  useEffect(() => {
    if (showEditor || readonly) {
      setShortcutActive(false);
    }
  }, [showEditor, readonly]);

  const handleShortcutActivation = useCallback(
    (active: boolean) => {
      if (readonly) return;
      setShortcutActive(active);
    },
    [readonly],
  );

  return { shortcutActive, handleShortcutActivation };
};

/**
 * Hook for managing NSFW content visibility
 */
export const useNsfwContent = (memo: Memo, initialShowNsfw?: boolean): UseNsfwContentReturn => {
  const [showNSFWContent, setShowNSFWContent] = useState(initialShowNsfw ?? false);
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;

  const nsfw =
    instanceMemoRelatedSetting.enableBlurNsfwContent &&
    memo.tags?.some((tag) => instanceMemoRelatedSetting.nsfwTags.some((nsfwTag) => tag === nsfwTag || tag.startsWith(`${nsfwTag}/`)));

  const toggleNsfwVisibility = useCallback(() => {
    setShowNSFWContent((prev) => !prev);
  }, []);

  return {
    nsfw: nsfw ?? false,
    showNSFWContent,
    toggleNsfwVisibility,
  };
};

/**
 * Hook for managing image preview dialog state
 */
export const useImagePreview = (): UseImagePreviewReturn => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({
    open: false,
    urls: [],
    index: 0,
  });

  const openPreview = useCallback((url: string) => {
    setPreviewState({ open: true, urls: [url], index: 0 });
  }, []);

  const closePreview = useCallback(() => {
    setPreviewState((prev) => ({ ...prev, open: false }));
  }, []);

  const setPreviewOpen = useCallback((open: boolean) => {
    setPreviewState((prev) => ({ ...prev, open }));
  }, []);

  return {
    previewState,
    openPreview,
    closePreview,
    setPreviewOpen,
  };
};

/**
 * Hook for fetching and managing memo creator data
 */
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
