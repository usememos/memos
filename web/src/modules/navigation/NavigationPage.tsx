import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileIcon,
  GripVerticalIcon,
  ImageIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  TrashIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  FormEvent,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addClip,
  addFileClip,
  addImageClip,
  addRichClip,
  buildClipWritePayload,
  clipPartKey,
  formatClipSize,
  getClipBlob,
  type NavClipItem,
  pruneClipBlobs,
  previewClip,
  readClips,
  removeClip,
  writeClips,
} from "./clipboard";
import { useNavStrings } from "./i18n";
import "./navigation.css";
import { isValidHttpUrl } from "./validate";
import type { CardDraft, CardDraftError } from "./editor";
import { addCard, addGroup, createCard, removeCard, removeGroup, renameGroup, updateCard, validateCardDraft } from "./editor";
import { moveCard, moveGroup } from "./reorder";
import { cycleIndex, flattenCards, searchNavConfig } from "./search";
import type { NavCard, NavConfig, NavGroup } from "./types";
import { useNavConfig } from "./useNavConfig";

/**
 * M5: config-backed card wall with client-side search, drag-and-drop, and
 * add/edit/delete. Search and reorder stay pure (see `search.ts` / `reorder.ts`);
 * editing is pure the same way (see `editor.ts`): dialogs only reshape the
 * in-memory config, then persist through the normal `save` path. Basic keyboard
 * interaction: `/` focuses the box, Escape clears it, and the arrow keys move a
 * roving highlight across the matched cards.
 */

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null);

interface CardDrag {
  cardId: string;
  groupId: string;
  index: number;
}

interface DropHint {
  groupId: string;
  index: number;
}

interface CardDialogState {
  open: true;
  mode: "create" | "edit";
  groupId: string;
  cardId?: string;
  initial: CardDraft;
}

interface NameDialogState {
  open: true;
  mode: "create" | "rename";
  groupId?: string;
  initialName: string;
}

interface ConfirmDialogState {
  open: true;
  kind: "card" | "group";
  groupId: string;
  cardId?: string;
}

const Card = ({
  card,
  active,
  dropBefore,
  dropAfter,
  dragDisabled,
  dragging,
  cardRef,
  onFocus,
  onEdit,
  onDelete,
  onDragStartCard,
  onDragOverCard,
  onDropCard,
}: {
  card: NavCard;
  active: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  dragDisabled: boolean;
  dragging: boolean;
  cardRef: (el: HTMLAnchorElement | null) => void;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStartCard: (event: ReactDragEvent<HTMLAnchorElement>) => void;
  onDragOverCard: (event: ReactDragEvent<HTMLAnchorElement>) => void;
  onDropCard: (event: ReactDragEvent<HTMLAnchorElement>) => void;
}) => {
  const t = useNavStrings();
  return (
    <div className="nav-page-card-shell group relative">
      <a
        ref={cardRef}
        href={card.url}
        target="_blank"
        rel="noreferrer"
        tabIndex={-1}
        draggable={!dragDisabled}
        data-active={active ? "true" : undefined}
        data-dragging={dragging ? "true" : undefined}
        onFocus={onFocus}
        onDragStart={onDragStartCard}
        onDragOver={onDragOverCard}
        onDrop={onDropCard}
        data-drop-before={dropBefore ? "true" : undefined}
        data-drop-after={dropAfter ? "true" : undefined}
        className="nav-page-card flex flex-col gap-1 rounded-xl p-4 focus:outline-none"
        data-testid="nav-card"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{card.title}</span>
          <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
        {card.note ? <span className="line-clamp-2 text-xs text-muted-foreground">{card.note}</span> : null}
        <span className="truncate text-xs text-muted-foreground/70">{card.url}</span>
      </a>
      <div className="nav-page-card-actions pointer-events-none absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          aria-label={t.editCard}
          data-testid="nav-card-edit"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit();
          }}
        >
          <PencilIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          aria-label={t.deleteCard}
          data-testid="nav-card-delete"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
};

const LoadingState = () => {
  const t = useNavStrings();
  return (
    <section className="border-border bg-card flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
      <LoaderCircleIcon className="size-4 animate-spin" />
      <span>{t.loading}</span>
    </section>
  );
};

const EmptyState = ({ onReset, isResetting }: { onReset: () => void; isResetting: boolean }) => {
  const t = useNavStrings();
  return (
    <section className="border-border bg-card flex flex-col items-start gap-3 rounded-xl border p-6">
      <h2 className="text-sm font-medium text-foreground">{t.emptyTitle}</h2>
      <p className="text-sm text-muted-foreground">{t.emptyBody}</p>
      <Button variant="outline" size="sm" disabled={isResetting} onClick={onReset}>
        <RotateCcwIcon />
        {t.reset}
      </Button>
    </section>
  );
};

const DegradedState = ({ onRetry }: { onRetry: () => void }) => {
  const t = useNavStrings();
  return (
    <section className="border-border bg-card flex flex-col items-start gap-2 rounded-xl border p-6">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <WifiOffIcon className="size-4" />
        {t.degradedTitle}
      </h2>
      <p className="text-sm text-muted-foreground">{t.degradedBody}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcwIcon />
        {t.retry}
      </Button>
    </section>
  );
};

const SearchEmptyState = ({ onClear }: { onClear: () => void }) => {
  const t = useNavStrings();
  return (
    <section className="border-border bg-card flex flex-col items-start gap-2 rounded-xl border p-6" role="status" data-testid="nav-search-empty">
      <h2 className="text-sm font-medium text-foreground">{t.searchEmptyTitle}</h2>
      <p className="text-sm text-muted-foreground">{t.searchEmptyBody}</p>
      <Button variant="outline" size="sm" onClick={onClear}>
        <XIcon />
        {t.clearSearch}
      </Button>
    </section>
  );
};

const draftErrorMessage = (error: CardDraftError, t: ReturnType<typeof useNavStrings>): string =>
  error === "titleRequired" ? t.titleRequired : error === "urlInvalid" ? t.urlInvalid : t.urlDuplicate;

const CardDialog = ({
  state,
  config,
  onClose,
  onSubmit,
}: {
  state: CardDialogState;
  config: NavConfig;
  onClose: () => void;
  onSubmit: (draft: CardDraft) => void;
}) => {
  const t = useNavStrings();
  const [title, setTitle] = useState(state.initial.title);
  const [url, setUrl] = useState(state.initial.url);
  const [note, setNote] = useState(state.initial.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const draft: CardDraft = { title, url, note };
    const problem = validateCardDraft(draft, config, state.cardId);
    if (problem) {
      setError(draftErrorMessage(problem, t));
      return;
    }
    onSubmit(draft);
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="sm" data-testid="nav-card-dialog">
        <DialogHeader>
          <DialogTitle>{state.mode === "create" ? t.addCard : t.editCard}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-card-title">{t.fieldTitle}</Label>
            <Input id="nav-card-title" data-testid="nav-card-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-card-url">{t.fieldUrl}</Label>
            <Input
              id="nav-card-url"
              data-testid="nav-card-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-card-note">{t.fieldNote}</Label>
            <Input id="nav-card-note" data-testid="nav-card-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert" data-testid="nav-card-error">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" size="sm" data-testid="nav-card-submit">
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const NameDialog = ({ state, onClose, onSubmit }: { state: NameDialogState; onClose: () => void; onSubmit: (name: string) => void }) => {
  const t = useNavStrings();
  const [name, setName] = useState(state.initialName);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t.nameRequired);
      return;
    }
    onSubmit(name);
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="sm" data-testid="nav-name-dialog">
        <DialogHeader>
          <DialogTitle>{state.mode === "create" ? t.addGroup : t.renameGroup}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-group-name">{t.fieldName}</Label>
            <Input id="nav-group-name" data-testid="nav-group-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert" data-testid="nav-name-error">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" size="sm" data-testid="nav-name-submit">
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ConfirmDialog = ({ state, onClose, onConfirm }: { state: ConfirmDialogState; onClose: () => void; onConfirm: () => void }) => {
  const t = useNavStrings();
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="sm" data-testid="nav-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{state.kind === "card" ? t.deleteCard : t.deleteGroup}</DialogTitle>
          <DialogDescription>{state.kind === "card" ? t.deleteCardConfirm : t.deleteGroupConfirm}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" variant="destructive" size="sm" data-testid="nav-confirm-delete" onClick={onConfirm}>
            {t.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NavigationPage = () => {
  const t = useNavStrings();
  const { state, isLoading, isError, refetch, save, reset, isResetting, isSaving } = useNavConfig();

  const [query, setQuery] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [cardDropHint, setCardDropHint] = useState<DropHint | null>(null);
  const [groupDropHint, setGroupDropHint] = useState<number | null>(null);
  const [cardDialog, setCardDialog] = useState<CardDialogState | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const cardDragRef = useRef<CardDrag | null>(null);
  const groupDragRef = useRef<string | null>(null);

  const config = state?.config ?? null;
  const filtered = useMemo(() => (config ? searchNavConfig(config, query) : null), [config, query]);
  const flatCards = useMemo(() => (filtered ? flattenCards(filtered) : []), [filtered]);
  const isSearching = query.trim() !== "";
  const canDrag = config !== null && !isSearching;

  const persist = useCallback(
    (next: NavConfig) => {
      if (!state || next === state.config) return;
      void save(next).catch(() => toast.error(t.saveFailed));
    },
    [save, state, t.saveFailed],
  );

  const moveFocus = useCallback(
    (delta: number) => {
      if (flatCards.length === 0) return;
      const currentIndex = activeCardId ? flatCards.findIndex((card) => card.id === activeCardId) : -1;
      const nextIndex = currentIndex < 0 ? (delta > 0 ? 0 : flatCards.length - 1) : cycleIndex(currentIndex, delta, flatCards.length);
      const next = flatCards[nextIndex];
      setActiveCardId(next.id);
      cardRefs.current.get(next.id)?.focus();
    },
    [flatCards, activeCardId],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setActiveCardId(null);
  }, []);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setActiveCardId(null);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
      event.currentTarget.blur();
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
      searchRef.current?.focus();
    }
  };

  // Clear the roving highlight when focus leaves the card list (e.g. clicking
  // into the search box or elsewhere). `relatedTarget` stays inside the list
  // while the arrow keys hop between cards, so the highlight is preserved there.
  const handleListBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setActiveCardId(null);
    }
  };

  const toggleCollapse = (group: NavGroup) => {
    if (!state) return;
    const next: NavConfig = {
      ...state.config,
      groups: state.config.groups.map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)),
    };
    persist(next);
  };

  const endDrag = () => {
    setDraggingCardId(null);
    setDraggingGroupId(null);
    setCardDropHint(null);
    setGroupDropHint(null);
    cardDragRef.current = null;
    groupDragRef.current = null;
  };

  const handleCardDragStart = (group: NavGroup, index: number) => (event: ReactDragEvent<HTMLAnchorElement>) => {
    cardDragRef.current = { cardId: group.items[index].id, groupId: group.id, index };
    setDraggingCardId(group.items[index].id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", group.items[index].url);
  };

  const resolveDropIndex = (event: ReactDragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? 1 : 0;
  };

  const handleCardDragOver = (group: NavGroup, index: number) => (event: ReactDragEvent<HTMLAnchorElement>) => {
    if (!cardDragRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setCardDropHint({ groupId: group.id, index: index + resolveDropIndex(event) });
  };

  const handleCardDrop = () => {
    const drag = cardDragRef.current;
    if (!drag || !state || !cardDropHint) {
      endDrag();
      return;
    }
    const next = moveCard(state.config, drag.cardId, cardDropHint.groupId, cardDropHint.index);
    persist(next);
    endDrag();
  };

  const handleEmptyGroupDragOver = (group: NavGroup) => (event: ReactDragEvent<HTMLParagraphElement>) => {
    if (!cardDragRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setCardDropHint({ groupId: group.id, index: 0 });
  };

  const handleGroupDragStart = (group: NavGroup) => (event: ReactDragEvent<HTMLButtonElement>) => {
    groupDragRef.current = group.id;
    setDraggingGroupId(group.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `nav-group:${group.id}`);
  };

  const handleGroupDragOver = (index: number) => (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!groupDragRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setGroupDropHint(index + resolveDropIndex(event));
  };

  const handleGroupDrop = () => {
    const groupId = groupDragRef.current;
    if (!groupId || !state || groupDropHint === null) {
      endDrag();
      return;
    }
    const next = moveGroup(state.config, groupId, groupDropHint);
    persist(next);
    endDrag();
  };

  const openCreateCard = (groupId: string) => {
    setCardDialog({ open: true, mode: "create", groupId, initial: { title: "", url: "", note: "" } });
  };

  const [clips, setClips] = useState<NavClipItem[]>(() => readClips());
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clipPreviews, setClipPreviews] = useState<Record<string, string>>({});

  const persistClips = useCallback((items: NavClipItem[]) => {
    setClips(items);
    writeClips(items);
    void pruneClipBlobs(items);
  }, []);

  const recordTextClip = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setClips((current) => {
      const next = addClip(trimmed, Date.now(), current);
      writeClips(next);
      return next;
    });
  }, []);

  const recordBinaryClip = useCallback(
    async (blob: Blob, fileName?: string) => {
      const now = Date.now();
      let next: NavClipItem[] = clips;
      if (blob.type.startsWith("image/")) {
        next = await addImageClip(blob, now, clips);
      } else {
        const file =
          blob instanceof File ? blob : new File([blob], fileName || "clipboard", { type: blob.type || "application/octet-stream" });
        next = await addFileClip(file, now, clips);
      }
      setClips(next);
      writeClips(next);
    },
    [clips],
  );

  /**
   * Pull text + images + mixed HTML from the system clipboard when the panel opens.
   * A single ClipboardItem that carries several MIME types is stored as one rich clip.
   */
  const captureSystemClipboard = useCallback(async () => {
    try {
      if (navigator.clipboard && "read" in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const payload: Record<string, Blob | string> = {};
          let hasBinary = false;
          for (const type of item.types) {
            try {
              const blob = await item.getType(type);
              if (type === "text/plain" || type === "text/html") {
                payload[type] = await blob.text();
              } else {
                payload[type] = blob;
                hasBinary = true;
              }
            } catch {
              // Skip unreadable representations.
            }
          }
          const kinds = Object.keys(payload);
          if (kinds.length >= 2 && (payload["text/html"] || payload["text/plain"])) {
            const next = await addRichClip(payload, Date.now(), clips);
            setClips(next);
            writeClips(next);
          } else if (hasBinary) {
            const image = kinds.find((type) => type.startsWith("image/"));
            if (image && payload[image] instanceof Blob) {
              await recordBinaryClip(payload[image] as Blob);
            } else {
              for (const type of kinds) {
                if (payload[type] instanceof File || payload[type] instanceof Blob) {
                  await recordBinaryClip(payload[type] as Blob);
                  break;
                }
              }
            }
          } else if (typeof payload["text/plain"] === "string") {
            recordTextClip(payload["text/plain"]);
          }
        }
        return;
      }
    } catch {
      // Fall through to text-only read.
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) recordTextClip(text);
    } catch {
      // Permission denied or unsupported — local pastes still record.
    }
  }, [recordTextClip, recordBinaryClip, clips]);

  // Load object URLs for image (and rich-with-image) clips currently in the list.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const missing = clips.filter((item) => {
        if (clipPreviews[item.id]) return false;
        if (item.kind === "image") return true;
        if (item.kind === "rich") return item.parts?.some((part) => part.startsWith("image/")) ?? false;
        return false;
      });
      for (const item of missing) {
        const key = item.kind === "rich" ? clipPartKey(item.id, item.parts?.find((p) => p.startsWith("image/")) ?? "") : item.id;
        const blob = await getClipBlob(key);
        if (!blob || cancelled) continue;
        const url = URL.createObjectURL(blob);
        setClipPreviews((current) => ({ ...current, [item.id]: url }));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [clips, clipPreviews]);

  useEffect(() => {
    const urls = Object.values(clipPreviews);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [clipPreviews]);

  const useClipText = (text: string) => {
    if (!state) return;
    if (isValidHttpUrl(text)) {
      let title = "";
      try {
        title = new URL(text).hostname.replace(/^www\./, "");
      } catch {
        title = "";
      }
      const groupId = state.config.groups[0]?.id;
      if (!groupId) return;
      setClipboardOpen(false);
      setCardDialog({ open: true, mode: "create", groupId, initial: { title, url: text, note: "" } });
      return;
    }
    setQuery(text);
    setActiveCardId(null);
    setClipboardOpen(false);
    searchRef.current?.focus();
  };

  const copyClip = async (item: NavClipItem) => {
    try {
      const payload = await buildClipWritePayload(item);
      const keys = Object.keys(payload);
      if (!keys.length) {
        toast.error(t.clipboardFailed);
        return;
      }
      const ClipboardItemCtor = window.ClipboardItem;
      if (keys.length === 1 && "text/plain" in payload) {
        await navigator.clipboard.writeText(await payload["text/plain"].text());
      } else if (ClipboardItemCtor && "write" in navigator.clipboard) {
        // Write every stored representation so paste targets keep the mixed layout.
        await navigator.clipboard.write([new ClipboardItemCtor(payload)]);
      } else {
        toast.error(t.clipboardFailed);
        return;
      }
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1200);
    } catch {
      toast.error(t.clipboardFailed);
    }
  };

  const handleSearchPaste = (event: ReactClipboardEvent<HTMLInputElement>) => {
    const clipboard = event.clipboardData;
    const files = Array.from(clipboard.files);
    const html = clipboard.getData("text/html");
    const text = clipboard.getData("text");

    // Mixed rich paste (HTML markup and/or images together with text).
    if (html.trim() || files.length > 0) {
      event.preventDefault();
      const payload: Record<string, Blob | string> = {};
      if (text) payload["text/plain"] = text;
      if (html.trim()) payload["text/html"] = html;
      for (const file of files) {
        payload[file.type || "application/octet-stream"] = file;
      }
      const hasImage = files.some((file) => file.type.startsWith("image/"));
      const isRich = Boolean(html.trim()) && (files.length > 0 || Boolean(text.trim()));
      void (async () => {
        if (isRich || (hasImage && text.trim())) {
          const next = await addRichClip(payload, Date.now(), clips);
          setClips(next);
          writeClips(next);
          return;
        }
        if (files.length > 0) {
          await recordBinaryClip(files[0], files[0].name);
          return;
        }
        recordTextClip(text);
      })();
      return;
    }

    if (text.trim()) recordTextClip(text);
  };

  const openEditCard = (group: NavGroup, card: NavCard) => {
    setCardDialog({
      open: true,
      mode: "edit",
      groupId: group.id,
      cardId: card.id,
      initial: { title: card.title, url: card.url, note: card.note ?? "" },
    });
  };

  const handleCardSubmit = (draft: CardDraft) => {
    if (!state || !cardDialog) return;
    const next =
      cardDialog.mode === "create"
        ? addCard(state.config, cardDialog.groupId, createCard(draft))
        : updateCard(state.config, cardDialog.cardId ?? "", draft);
    persist(next);
    setCardDialog(null);
  };

  const openCreateGroup = () => {
    setNameDialog({ open: true, mode: "create", initialName: "" });
  };

  const openRenameGroup = (group: NavGroup) => {
    setNameDialog({ open: true, mode: "rename", groupId: group.id, initialName: group.name });
  };

  const handleNameSubmit = (name: string) => {
    if (!state || !nameDialog) return;
    const next = nameDialog.mode === "create" ? addGroup(state.config, name) : renameGroup(state.config, nameDialog.groupId ?? "", name);
    persist(next);
    setNameDialog(null);
  };

  const openDeleteCard = (group: NavGroup, card: NavCard) => {
    setConfirmDialog({ open: true, kind: "card", groupId: group.id, cardId: card.id });
  };

  const openDeleteGroup = (group: NavGroup) => {
    setConfirmDialog({ open: true, kind: "group", groupId: group.id });
  };

  const handleConfirmDelete = () => {
    if (!state || !confirmDialog) return;
    const next =
      confirmDialog.kind === "card"
        ? removeCard(state.config, confirmDialog.cardId ?? "")
        : removeGroup(state.config, confirmDialog.groupId);
    persist(next);
    setConfirmDialog(null);
  };

  const isDegraded = state?.source === "cache";

  return (
    <div className="flex w-full flex-col gap-5">
      {isLoading ? (
        <LoadingState />
      ) : isError && !config ? (
        <DegradedState onRetry={() => void refetch()} />
      ) : !config ? (
        <EmptyState onReset={() => void reset().catch(() => {})} isResetting={isResetting} />
      ) : (
        <div className="flex flex-col gap-4">
          {isDegraded ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="nav-degraded-note">
              <WifiOffIcon className="size-3.5" />
              {t.degradedBody}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            {isSaving ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="nav-saving">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                {t.saving}
              </span>
            ) : null}
            <Button variant="outline" size="sm" data-testid="nav-add-group" onClick={openCreateGroup}>
              <PlusIcon />
              {t.addGroup}
            </Button>
            <Button variant="outline" size="sm" disabled={isResetting} onClick={() => void reset().catch(() => {})}>
              <RotateCcwIcon />
              {t.reset}
            </Button>
          </div>

          {/* Spotlight-style search: large pill + circular scope actions. */}
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <div role="search" className="nav-spotlight relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={handleQueryChange}
                  onPaste={handleSearchPaste}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t.searchPlaceholder}
                  aria-label={t.searchPlaceholder}
                  className="nav-spotlight-input h-12 rounded-full pr-10 pl-12 text-base"
                  data-testid="nav-search-input"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label={t.clearSearch}
                    className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <XIcon className="size-4" />
                  </button>
                ) : null}
              </div>
              <Popover
                open={clipboardOpen}
                onOpenChange={(open) => {
                  setClipboardOpen(open);
                  if (open) void captureSystemClipboard();
                }}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            aria-label={t.clipboardHistory}
                            data-testid="nav-clipboard-add"
                            className="nav-spotlight-action flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          />
                        }
                      />
                    }
                  >
                    <ClipboardIcon className="size-5" strokeWidth={1.8} />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t.clipboardHistory}</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" side="bottom" className="w-80 p-2" data-testid="nav-clipboard-panel">
                  <div className="flex items-center justify-between px-1 pb-1.5 pt-0.5">
                    <span className="text-sm font-medium text-foreground">{t.clipboardHistory}</span>
                    <span className="text-[11px] text-muted-foreground">{t.clipboardHistoryHint}</span>
                  </div>
                  {clips.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t.clipboardHistoryEmpty}</p>
                  ) : (
                    <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                      {clips.map((item) => (
                        <li key={item.id} className="group/clip flex items-start gap-1.5 rounded-md px-1.5 py-1.5 hover:bg-accent/60">
                          {item.kind === "image" || (item.kind === "rich" && item.parts?.some((part) => part.startsWith("image/"))) ? (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
                              {clipPreviews[item.id] ? (
                                <img src={clipPreviews[item.id]} alt="" className="size-full object-cover" />
                              ) : (
                                <ImageIcon className="size-4 text-muted-foreground" />
                              )}
                            </div>
                          ) : item.kind === "rich" ? (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                              <span className="text-[10px] font-medium text-muted-foreground">{t.clipboardRich}</span>
                            </div>
                          ) : item.kind === "file" ? (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                              <FileIcon className="size-4 text-muted-foreground" />
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-start"
                            onClick={() => {
                              if (item.kind === "text") useClipText(item.text);
                            }}
                            title={item.kind === "text" ? item.text : (item.name ?? item.text)}
                          >
                            {item.kind === "text" ? (
                              <span className="line-clamp-2 break-all text-xs leading-4 text-foreground">{previewClip(item.text)}</span>
                            ) : (
                              <>
                                <span className="line-clamp-2 break-all text-xs leading-4 text-foreground">
                                  {item.kind === "rich" ? previewClip(item.text, 80) : item.name || item.mime}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {item.kind === "rich" ? t.clipboardRich : item.mime}
                                  {item.size ? ` · ${formatClipSize(item.size)}` : ""}
                                </span>
                              </>
                            )}
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t.clipboardCopy}
                              onClick={() => void copyClip(item)}
                            >
                              {copiedId === item.id ? <CheckIcon className="size-3.5 text-primary" /> : <CopyIcon className="size-3.5" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t.clipboardRemove}
                              onClick={() => persistClips(removeClip(item.id, clips))}
                            >
                              <XIcon className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </TooltipProvider>

          {isSearching && flatCards.length === 0 ? (
            <SearchEmptyState onClear={clearSearch} />
          ) : (
            <div className="flex flex-col gap-5" onKeyDown={handleListKeyDown} onBlur={handleListBlur}>
              {filtered?.groups.map((group, groupIndex) => (
                <div key={group.id} className="flex flex-col gap-3" data-testid="nav-group">
                  <div className="flex items-center gap-1.5 self-start">
                    <button
                      type="button"
                      draggable={canDrag}
                      onDragStart={handleGroupDragStart(group)}
                      onDragOver={handleGroupDragOver(groupIndex)}
                      onDrop={handleGroupDrop}
                      onDragEnd={endDrag}
                      data-dragging={draggingGroupId === group.id ? "true" : undefined}
                      data-drop-before={groupDropHint === groupIndex ? "true" : undefined}
                      data-drop-after={groupDropHint === groupIndex + 1 ? "true" : undefined}
                      className={`nav-page-group group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-foreground ${canDrag ? "cursor-grab" : ""}`}
                      onClick={() => toggleCollapse(group)}
                      aria-expanded={!group.collapsed}
                    >
                      {canDrag ? (
                        <GripVerticalIcon className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground" />
                      ) : null}
                      {group.collapsed ? (
                        <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium leading-none">{group.name}</span>
                      <span className="nav-page-count flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium leading-5">
                        {group.items.length}
                      </span>
                      <span className="sr-only">{group.collapsed ? t.expand : t.collapse}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={t.addCard}
                      data-testid="nav-add-card"
                      onClick={() => openCreateCard(group.id)}
                    >
                      <PlusIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={t.renameGroup}
                      data-testid="nav-rename-group"
                      onClick={() => openRenameGroup(group)}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={t.deleteGroup}
                      data-testid="nav-delete-group"
                      onClick={() => openDeleteGroup(group)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>

                  {!group.collapsed ? (
                    group.items.length === 0 ? (
                      <p
                        className="border-border rounded-xl border border-dashed p-4 text-sm text-muted-foreground"
                        onDragOver={handleEmptyGroupDragOver(group)}
                        onDrop={handleCardDrop}
                        onDragEnd={endDrag}
                      >
                        {t.emptyGroup}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {group.items.map((card, index) => (
                          <Card
                            key={card.id}
                            card={card}
                            active={card.id === activeCardId}
                            dropBefore={cardDropHint?.groupId === group.id && cardDropHint.index === index}
                            dropAfter={cardDropHint?.groupId === group.id && cardDropHint.index === index + 1}
                            dragDisabled={!canDrag}
                            dragging={draggingCardId === card.id}
                            onFocus={() => setActiveCardId(card.id)}
                            onEdit={() => openEditCard(group, card)}
                            onDelete={() => openDeleteCard(group, card)}
                            cardRef={(el) => {
                              if (el) cardRefs.current.set(card.id, el);
                              else cardRefs.current.delete(card.id);
                            }}
                            onDragStartCard={handleCardDragStart(group, index)}
                            onDragOverCard={handleCardDragOver(group, index)}
                            onDropCard={handleCardDrop}
                          />
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cardDialog && config ? (
        <CardDialog state={cardDialog} config={config} onClose={() => setCardDialog(null)} onSubmit={handleCardSubmit} />
      ) : null}
      {nameDialog ? <NameDialog state={nameDialog} onClose={() => setNameDialog(null)} onSubmit={handleNameSubmit} /> : null}
      {confirmDialog ? (
        <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} onConfirm={handleConfirmDelete} />
      ) : null}
    </div>
  );
};

export default NavigationPage;
