import { create } from "@bufbuild/protobuf";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import MemoEditor from "@/components/MemoEditor";
import { cacheService } from "@/components/MemoEditor/services/cacheService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCreateMemo } from "@/hooks/useMemoQueries";
import { buildBookmarkContent, isValidBookmarkUrl } from "@/lib/bookmark";
import { spaceScopedCacheKey } from "@/lib/resource-names";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

export { buildBookmarkContent } from "@/lib/bookmark";

const createMemoFromContent = (content: string, space?: string): Memo => create(MemoSchema, { content, space });

/**
 * Quick-capture target for the bookmarklet:
 * `/bookmark?url=…&title=…&tags=unread&autosave=1`
 *
 * With `autosave=1` the memo is created directly and the user is sent home —
 * the bookmarklet flow where the app should never get in the way. Without it,
 * a prefilled editor is shown for review.
 */
const Bookmark = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { selectedSpaceName } = useSpaceContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const createMemo = useCreateMemo();
  const autosaveStartedRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [inputUrl, setInputUrl] = useState(searchParams.get("url") ?? "");
  const [invalidInput, setInvalidInput] = useState(false);

  const url = searchParams.get("url") ?? "";
  const title = searchParams.get("title") ?? "";
  const tagsParam = searchParams.get("tags") ?? "unread";
  const tags = useMemo(
    () =>
      tagsParam
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsParam],
  );
  const validUrl = isValidBookmarkUrl(url);
  const autosave = searchParams.get("autosave") === "1" && validUrl;

  const content = useMemo(() => buildBookmarkContent(url, title, tags), [url, title, tags]);
  const editorCacheKey = spaceScopedCacheKey(`bookmark:${encodeURIComponent(url.trim())}`, selectedSpaceName);
  const cachedDraft = cacheService.loadDraft(cacheService.key(user?.name ?? "", editorCacheKey));
  const initialContent = cachedDraft.content || cachedDraft.attachments.length ? undefined : content;

  useEffect(() => {
    if (!autosave || autosaveStartedRef.current || !content) {
      return;
    }
    autosaveStartedRef.current = true;
    createMemo.mutate(createMemoFromContent(content, selectedSpaceName), {
      onSuccess: () => navigate("/"),
      onError: () => {
        toast.error(t("bookmarks.capture-save-failed"));
        const draftParams = new URLSearchParams(searchParams);
        draftParams.delete("autosave");
        setSearchParams(draftParams, { replace: true });
      },
    });
  }, [autosave, content, createMemo, navigate, searchParams, selectedSpaceName, setSearchParams, t]);

  const bookmarklet = `javascript:location.href='${window.location.origin}/bookmark?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&autosave=1'`;

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("bookmarks.capture-copy-failed"));
    }
  };

  if (!validUrl) {
    return (
      <div className="flex w-full min-h-full items-center justify-center bg-background p-8 text-foreground">
        <div className="w-full max-w-md space-y-6 text-muted-foreground">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("bookmarks.capture-title")}</h1>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isValidBookmarkUrl(inputUrl)) {
                setInvalidInput(true);
                return;
              }
              const draftParams = new URLSearchParams(searchParams);
              draftParams.set("url", inputUrl.trim());
              draftParams.delete("autosave");
              setSearchParams(draftParams);
            }}
          >
            <Label htmlFor="bookmark-url">{t("bookmarks.capture-url-label")}</Label>
            <Input
              id="bookmark-url"
              type="url"
              required
              value={inputUrl}
              placeholder="https://example.com"
              className="h-10"
              aria-invalid={invalidInput || !!url.trim()}
              aria-describedby={invalidInput || url.trim() ? "bookmark-url-error" : undefined}
              onChange={(event) => {
                setInputUrl(event.target.value);
                setInvalidInput(false);
              }}
            />
            {(invalidInput || !!url.trim()) && (
              <p id="bookmark-url-error" role="alert" className="text-sm text-destructive">
                {t("bookmarks.capture-invalid-url")}
              </p>
            )}
            <Button type="submit" className="h-10">
              {t("bookmarks.capture-continue")}
            </Button>
          </form>
          <div className="space-y-3 border-t border-border pt-6">
            <p>{t("bookmarks.capture-no-url")}</p>
            <p className="text-sm">{t("bookmarks.capture-drag-hint")}</p>
            <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
              <a
                href="#bookmarklet"
                ref={(element) => {
                  element?.setAttribute("href", bookmarklet);
                }}
                onClick={(event) => event.preventDefault()}
                className="inline-flex items-center justify-center rounded-md border border-border bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("bookmarks.capture-button-label")}
              </a>
              <button
                type="button"
                onClick={handleCopyBookmarklet}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {copied ? <CheckIcon className="size-3.5 text-primary" /> : <CopyIcon className="size-3.5" />}
                <span>{copied ? t("bookmarks.capture-bookmarklet-copied") : t("bookmarks.capture-copy-bookmarklet")}</span>
              </button>
            </div>
          </div>
          <div className="pt-2">
            <Link to="/" className="text-sm underline underline-offset-2 hover:text-foreground">
              {t("bookmarks.capture-go-home")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (autosave) {
    return <div className="w-full min-h-full bg-background text-foreground p-8 text-muted-foreground">{t("bookmarks.capture-saving")}</div>;
  }

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-lg font-medium">{t("bookmarks.capture-title")}</h1>
        <MemoEditor
          key={editorCacheKey}
          cacheKey={editorCacheKey}
          initialContent={initialContent}
          defaultSpace={selectedSpaceName}
          autoFocus
          onConfirm={() => navigate("/")}
        />
      </div>
    </div>
  );
};

export default Bookmark;
