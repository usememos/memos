import { useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
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

const EmbeddedMemo = ({ resourceId, params: paramsStr }: Props) => {
  const context = useContext(RendererContext);
  const loadingState = useLoading();
  const memoStore = useMemoStore();
  const memo = memoStore.getMemoByUid(resourceId);
  const resourceName = `memos/${resourceId}`;

  useEffect(() => {
    memoStore.searchMemos(`uid == "${resourceId}" && include_comments == true`).finally(() => loadingState.setFinish());
  }, [resourceId]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!memo) {
    return <Error message={`Memo not found: ${resourceId}`} />;
  }
  if (memo.name === context.memoName || context.embeddedMemos.has(resourceName)) {
    return <Error message={`Nested Rendering Error: ![[${resourceName}]]`} />;
  }

  // Add the memo to the set of embedded memos. This is used to prevent infinite loops when a memo embeds itself.
  context.embeddedMemos.add(resourceName);
  const params = new URLSearchParams(paramsStr);
  const inlineMode = params.has("inline");
  if (inlineMode) {
    return (
      <div className="w-full">
        <MemoContent
          key={`${memo.name}-${memo.updateTime}`}
          memoName={memo.name}
          nodes={memo.nodes}
          embeddedMemos={context.embeddedMemos}
        />
        <MemoResourceListView resources={memo.resources} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-start items-start w-full px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 hover:shadow">
      <div className="w-full mb-1 flex flex-row justify-between items-center">
        <div className="text-sm leading-6 text-gray-400 select-none">
          <relative-time datetime={memo.displayTime?.toISOString()} format="datetime" tense="past"></relative-time>
        </div>
        <Link className="hover:opacity-80" to={`/m/${memo.uid}`} unstable_viewTransition>
          <Icon.ArrowUpRight className="w-5 h-auto opacity-80 text-gray-400" />
        </Link>
      </div>
      <MemoContent
        contentClassName="line-clamp-3"
        key={`${memo.name}-${memo.updateTime}`}
        memoName={memo.name}
        nodes={memo.nodes}
        embeddedMemos={context.embeddedMemos}
      />
      <MemoResourceListView resources={memo.resources} />
    </div>
  );
};

export default EmbeddedMemo;
