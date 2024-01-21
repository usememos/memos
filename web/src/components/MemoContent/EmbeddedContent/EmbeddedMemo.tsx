import { useContext, useEffect } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import useLoading from "@/hooks/useLoading";
import { useMemoStore } from "@/store/v1";
import MemoContent from "..";
import { RendererContext } from "../types";
import Error from "./Error";

interface Props {
  resourceId: string;
  params: string;
}

const EmbeddedMemo = ({ resourceId }: Props) => {
  const context = useContext(RendererContext);
  const loadingState = useLoading();
  const memoStore = useMemoStore();
  const memo = memoStore.getMemoByName(resourceId);
  const resourceName = `memos/${resourceId}`;

  useEffect(() => {
    memoStore.getOrFetchMemoByName(resourceId).finally(() => loadingState.setFinish());
  }, [resourceId]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!memo) {
    return <Error message={`Memo not found: ${resourceId}`} />;
  }
  if (memo.id === context.memoId || context.embeddedMemos.has(resourceName)) {
    return <Error message={`Nested Rendering Error: ![[${resourceName}]]`} />;
  }

  // Add the memo to the set of embedded memos. This is used to prevent infinite loops when a memo embeds itself.
  context.embeddedMemos.add(resourceName);
  return (
    <div className="w-full">
      <MemoContent nodes={memo.nodes} memoId={memo.id} embeddedMemos={context.embeddedMemos} />
      <MemoResourceListView resources={memo.resources} />
    </div>
  );
};

export default EmbeddedMemo;
