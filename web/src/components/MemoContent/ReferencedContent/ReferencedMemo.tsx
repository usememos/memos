import { useContext, useEffect } from "react";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useMemoStore } from "@/store/v1";
import { RendererContext } from "../types";
import Error from "./Error";

interface Props {
  resourceId: string;
  params: string;
}

const ReferencedMemo = ({ resourceId }: Props) => {
  const context = useContext(RendererContext);
  const navigateTo = useNavigateTo();
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

  const displayContent = memo.content.length > 12 ? `${memo.content.slice(0, 12)}...` : memo.content;

  const handleGotoMemoDetailPage = () => {
    navigateTo(`/m/${memo.name}`);
  };

  // Add the memo to the set of embedded memos. This is used to prevent infinite loops when a memo embeds itself.
  context.embeddedMemos.add(resourceName);
  return (
    <span
      className="text-blue-600 whitespace-nowrap dark:text-blue-400 cursor-pointer underline break-all hover:opacity-80 decoration-1"
      onClick={handleGotoMemoDetailPage}
    >
      {displayContent}
    </span>
  );
};

export default ReferencedMemo;
