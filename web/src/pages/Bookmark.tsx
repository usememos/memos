import { create } from "@bufbuild/protobuf";
import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import MemoEditor from "@/components/MemoEditor";
import { useCreateMemo } from "@/hooks/useMemoQueries";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const createMemo = useCreateMemo();
  const autosaveStartedRef = useRef(false);

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

  if (!url.trim()) {
    const bookmarklet = `javascript:location.href='${window.location.origin}/bookmark?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&autosave=1'`;
    return (
      <div className="flex w-full min-h-full items-center justify-center bg-background p-8 text-foreground">
        <div className="max-w-md space-y-3 text-center text-muted-foreground">
          <p>Nothing to save — this page expects a `url` query parameter.</p>
          <p className="text-sm">Drag this to your bookmarks bar for one-click capture:</p>
          <a
            href={bookmarklet}
            className="inline-block rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground no-underline"
          >
            Save to memos
          </a>
          <div>
            <Link to="/" className="underline underline-offset-2">
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (autosave) {
    return <div className="w-full min-h-full bg-background text-foreground p-8 text-muted-foreground">Saving bookmark…</div>;
  }

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-lg font-medium">Save bookmark</h1>
        <MemoEditor cacheKey="bookmark" initialContent={content} autoFocus onConfirm={() => navigate("/")} />
      </div>
    </div>
  );
};

export default Bookmark;
