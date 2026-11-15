import type { Editor, TagsOptions } from "@usememos/editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedMentionUsernames } from "@/contexts/MentionResolutionContext";
import { useDebouncedEffect } from "@/hooks";
import { memoMentionOptions, memoTagOptions } from "@/lib/memo-markdown";

/** How long typing pauses before the mentions in a draft are looked up. */
const MENTION_LOOKUP_DELAY_MS = 400;

export interface MemoDecorations {
  /** `tags()` class, attributes and click: inline tints in the viewer's custom tag colors. */
  readonly tags: Pick<TagsOptions, "class" | "attributes" | "onClick">;
  /** `mentions()` class, attributes and click: the primary color for people who exist. */
  readonly mentions: Pick<TagsOptions, "class" | "attributes" | "onClick">;
}

export interface MemoDecorationHandlers {
  /** A tag was clicked to be followed, without its `#`. */
  onTagClick?: (tag: string) => void;
  /** A mention of someone who exists was clicked to be followed, without its `@`. Unknown names are plain text. */
  onMentionClick?: (username: string) => void;
}

/**
 * What a memo's tags and mentions look like wherever a memo is shown, and what a click on
 * them does. The options are stable for the editor's lifetime and read the latest data
 * and handlers through refs; `editor` decorates again when that data changes.
 *
 * Tag colors come from the viewer's tag settings. Mentions resolve through the shared
 * provider of the surrounding list when it knows this content, otherwise with a lookup
 * of their own. While editing, a half-typed name is not looked up: mentions are read
 * once typing pauses, and until a lookup answers, the people already found stay found.
 */
export function useMemoDecorations(
  editor: Editor | null,
  value: string,
  editable: boolean,
  handlers: MemoDecorationHandlers = {},
): MemoDecorations {
  const { userTagsSetting } = useAuth();
  const [settled, setSettled] = useState(value);
  useDebouncedEffect(() => setSettled(value), MENTION_LOOKUP_DELAY_MS, [value]);
  const resolved = useResolvedMentionUsernames(editable ? settled : value);

  const tagsSettingRef = useRef(userTagsSetting);
  tagsSettingRef.current = userTagsSetting;
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const handlersRef = useRef({ ...handlers, editable });
  handlersRef.current = { ...handlers, editable };
  const tagsInteractive = !editable && Boolean(handlers.onTagClick);

  useEffect(() => {
    if (!editor || !tagsInteractive) return;
    let pressedTag: HTMLElement | null = null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editor.isEditable || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const tag = event.target;
      if (!(tag instanceof HTMLElement) || !tag.matches('[data-tag][role="button"]')) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.key === "Enter") tag.click();
      else pressedTag = tag;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      const tag = pressedTag;
      pressedTag = null;
      if (!tag || event.target !== tag || editor.isEditable) return;
      event.preventDefault();
      event.stopPropagation();
      tag.click();
    };
    const handleFocusOut = () => {
      pressedTag = null;
    };
    editor.root.addEventListener("keydown", handleKeyDown);
    editor.root.addEventListener("keyup", handleKeyUp);
    editor.root.addEventListener("focusout", handleFocusOut);
    return () => {
      editor.root.removeEventListener("keydown", handleKeyDown);
      editor.root.removeEventListener("keyup", handleKeyUp);
      editor.root.removeEventListener("focusout", handleFocusOut);
    };
  }, [editor, tagsInteractive]);

  // Decorate again only when what the decorations read changed: a new editor already
  // decorates with the current values, and a lookup that answers the same is a no-op.
  const mentionKey = useMemo(() => [...resolved].sort().join(" "), [resolved]);
  const decorated = useRef({ mentionKey, userTagsSetting, tagsInteractive });
  useEffect(() => {
    const changed =
      decorated.current.mentionKey !== mentionKey ||
      decorated.current.userTagsSetting !== userTagsSetting ||
      decorated.current.tagsInteractive !== tagsInteractive;
    decorated.current = { mentionKey, userTagsSetting, tagsInteractive };
    if (changed) editor?.redecorate();
  }, [editor, mentionKey, userTagsSetting, tagsInteractive]);

  return useMemo(
    () => ({
      tags: {
        ...memoTagOptions(
          () => tagsSettingRef.current,
          () => !handlersRef.current.editable && Boolean(handlersRef.current.onTagClick),
        ),
        onClick: ({ match }) => {
          const onTagClick = handlersRef.current.onTagClick;
          if (!onTagClick) return false;
          onTagClick(match.slice(1));
          return true;
        },
      },
      mentions: {
        ...memoMentionOptions((username) => resolvedRef.current.has(username)),
        onClick: ({ match }) => {
          const username = match.slice(1);
          const onMentionClick = handlersRef.current.onMentionClick;
          if (!onMentionClick || !resolvedRef.current.has(username)) return false;
          onMentionClick(username);
          return true;
        },
      },
    }),
    [],
  );
}
