import { useEffect } from "react";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useMemoStore } from "@/store/v1";
import Error from "./Error";

interface Props {
  resourceId: string;
  params: string;
}

const ReferencedMemo = ({ resourceId, params: paramsStr }: Props) => {
  const navigateTo = useNavigateTo();
  const loadingState = useLoading();
  const memoStore = useMemoStore();
  const memo = memoStore.getMemoByUid(resourceId);
  const params = new URLSearchParams(paramsStr);

  useEffect(() => {
    memoStore.searchMemos(`uid == "${resourceId}" && include_comments == true`).finally(() => loadingState.setFinish());
  }, [resourceId]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!memo) {
    return <Error message={`Memo not found: ${resourceId}`} />;
  }

  const paramsText = params.has("text") ? params.get("text") : undefined;
  const displayContent = paramsText || (memo.content.length > 12 ? `${memo.content.slice(0, 12)}...` : memo.content);

  const handleGotoMemoDetailPage = () => {
    navigateTo(`/m/${memo.uid}`);
  };

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
