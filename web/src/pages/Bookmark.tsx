import { create } from "@bufbuild/protobuf";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import MemoEditor from "@/components/MemoEditor";
import { useCreateMemo } from "@/hooks/useMemoQueries";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

/** Builds the memo content for a captured bookmark. */
export const buildBookmarkContent = (url: string, title: string, tags: string[]) => {
  const trimmedUrl = url.trim();
  const trimmedTitle = title.trim();
  if (!trimmedUrl) {
    return "";
  }
  const link = trimmedTitle ? `[${trimmedTitle}](${trimmedUrl})` : trimmedUrl;
  const tagString = tags
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter((tag) => tag !== "")
    .map((tag) => `#${tag}`)
    .join(" ");
  return tagString ? `${link} ${tagString}` : link;
};

const createMemoFromContent = (content: string): Memo => create(MemoSchema, { content });

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const createMemo = useCreateMemo();
  const autosaveStartedRef = useRef(false);
  const [copied, setCopied] = useState(false);

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
  const autosave = searchParams.get("autosave") === "1" && url.trim() !== "";

  const content = useMemo(() => buildBookmarkContent(url, title, tags), [url, title, tags]);

  useEffect(() => {
    if (!autosave || autosaveStartedRef.current || !content) {
      return;
    }
    autosaveStartedRef.current = true;
    createMemo.mutate(createMemoFromContent(content), {
      onSuccess: () => navigate("/"),
      onError: () => navigate(`/bookmark?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`),
    });
  }, [autosave, content, createMemo, navigate, title, url]);

  const bookmarklet = `javascript:location.href='${window.location.origin}/bookmark?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&autosave=1'`;

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write might fail in restricted environments
    }
  };

  if (!url.trim()) {
    return (
      <div className="flex w-full min-h-full items-center justify-center bg-background p-8 text-foreground">
        <div className="max-w-md space-y-3 text-center text-muted-foreground">
          <p>{t("bookmarks.capture-no-url")}</p>
          <p className="text-sm">{t("bookmarks.capture-drag-hint")}</p>
          <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
            <a
              href={bookmarklet}
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
        <MemoEditor cacheKey="bookmark" initialContent={content} autoFocus onConfirm={() => navigate("/")} />
      </div>
    </div>
  );
};

export default Bookmark;
