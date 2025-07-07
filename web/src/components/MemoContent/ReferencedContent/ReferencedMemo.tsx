import { observer } from "mobx-react-lite";
import { useContext, useEffect } from "react";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { memoStore } from "@/store";
import { memoNamePrefix } from "@/store/common";
import { RendererContext } from "../types";
import Error from "./Error";

interface Props {
  resourceId: string;
  params: string;
}

const ReferencedMemo = observer(({ resourceId: uid, params: paramsStr }: Props) => {
  const navigateTo = useNavigateTo();
  const loadingState = useLoading();
  const memoName = `${memoNamePrefix}${uid}`;
  const memo = memoStore.getMemoByName(memoName);
  const params = new URLSearchParams(paramsStr);
  const context = useContext(RendererContext);

  useEffect(() => {
    memoStore.getOrFetchMemoByName(memoName).finally(() => loadingState.setFinish());
  }, [memoName]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!memo) {
    return <Error message={`Memo not found: ${uid}`} />;
  }

  const paramsText = params.has("text") ? params.get("text") : undefined;
  const displayContent = paramsText || (memo.snippet.length > 12 ? `${memo.snippet.slice(0, 12)}...` : memo.snippet);

  const handleGotoMemoDetailPage = () => {
    navigateTo(`/${memo.name}`, {
      state: {
        from: context.parentPage,
      },
    });
  };

  return (
    <span
      className="text-primary whitespace-nowrap cursor-pointer underline break-all hover:text-primary/80 decoration-1"
      onClick={handleGotoMemoDetailPage}
    >
      {displayContent}
    </span>
  );
});

export default ReferencedMemo;
