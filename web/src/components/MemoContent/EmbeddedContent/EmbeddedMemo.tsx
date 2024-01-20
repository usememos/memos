import { useContext, useEffect } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import useLoading from "@/hooks/useLoading";
import { useMemoStore } from "@/store/v1";
import MemoContent from "..";
import { RendererContext } from "../types";
import Error from "./Error";

interface Props {
  memoId: number;
  params: string;
}

const EmbeddedMemo = ({ memoId }: Props) => {
  const context = useContext(RendererContext);
  const loadingState = useLoading();
  const memoStore = useMemoStore();
  const memo = memoStore.getMemoById(memoId);
  const resourceName = `memos/${memoId}`;

  useEffect(() => {
    memoStore.getOrFetchMemoById(memoId).finally(() => loadingState.setFinish());
  }, [memoId]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!memo) {
    return <Error message={`Memo not found: ${memoId}`} />;
  }
  if (memoId === context.memoId || context.embeddedMemos.has(resourceName)) {
    return <Error message={`Nested Rendering Error: ![[${resourceName}]]`} />;
  }

  // Add the memo to the set of embedded memos. This is used to prevent infinite loops when a memo embeds itself.
  context.embeddedMemos.add(resourceName);
  return (
    <div className="w-full">
      <MemoContent nodes={memo.nodes} memoId={memoId} embeddedMemos={context.embeddedMemos} />
      <MemoResourceListView resources={memo.resources} />
    </div>
  );
};

export default EmbeddedMemo;
