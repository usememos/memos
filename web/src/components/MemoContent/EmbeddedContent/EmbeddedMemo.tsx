import copy from "copy-to-clipboard";
import { ArrowUpRightIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useContext, useEffect } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import MemoAttachmentListView from "@/components/MemoAttachmentListView";
import useLoading from "@/hooks/useLoading";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { extractMemoIdFromName } from "@/store/common";
import MemoContent from "..";
import { RendererContext } from "../types";
import Error from "./Error";

interface Props {
  resourceId: string;
  params: string;
}

const EmbeddedMemo = observer(({ resourceId: uid, params: paramsStr }: Props) => {
  const context = useContext(RendererContext);
  const loadingState = useLoading();
  const memoName = `memos/${uid}`;
  const memo = memoStore.getMemoByName(memoName);

  useEffect(() => {
    memoStore.getOrFetchMemoByName(memoName).finally(() => loadingState.setFinish());
  }, [memoName]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!memo) {
    return <Error message={`Memo not found: ${uid}`} />;
  }

  const params = new URLSearchParams(paramsStr);
  const useSnippet = params.has("snippet");
  const inlineMode = params.has("inline");
  if (!useSnippet && (memo.name === context.memoName || context.embeddedMemos.has(memoName))) {
    return <Error message={`Nested Rendering Error: ![[${memoName}]]`} />;
  }

  // Add the memo to the set of embedded memos. This is used to prevent infinite loops when a memo embeds itself.
  context.embeddedMemos.add(memoName);
  const contentNode = useSnippet ? (
    <div className={cn("text-muted-foreground", inlineMode ? "" : "line-clamp-3")}>{memo.snippet}</div>
  ) : (
    <>
      <MemoContent
        contentClassName={inlineMode ? "" : "line-clamp-3"}
        memoName={memo.name}
        nodes={memo.nodes}
        embeddedMemos={context.embeddedMemos}
      />
      <MemoAttachmentListView attachments={memo.attachments} />
    </>
  );
  if (inlineMode) {
    return <div className="w-full">{contentNode}</div>;
  }

  const copyMemoUid = (uid: string) => {
    copy(uid);
    toast.success("Copied memo UID to clipboard");
  };

  return (
    <div className="relative flex flex-col justify-start items-start w-full px-3 py-2 bg-card rounded-lg border border-border hover:shadow-md transition-shadow">
      <div className="w-full mb-1 flex flex-row justify-between items-center text-muted-foreground">
        <div className="text-sm leading-5 select-none">
          <relative-time datetime={memo.displayTime?.toISOString()} format="datetime"></relative-time>
        </div>
        <div className="flex justify-end items-center gap-1">
          <span
            className="text-xs text-muted-foreground leading-5 cursor-pointer hover:text-foreground"
            onClick={() => copyMemoUid(extractMemoIdFromName(memo.name))}
          >
            {extractMemoIdFromName(memo.name).slice(0, 6)}
          </span>
          <Link
            className="text-muted-foreground hover:text-foreground"
            to={`/${memo.name}`}
            state={{ from: context.parentPage }}
            viewTransition
          >
            <ArrowUpRightIcon className="w-5 h-auto" />
          </Link>
        </div>
      </div>
      {contentNode}
    </div>
  );
});

export default EmbeddedMemo;
