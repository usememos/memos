import { useContext, useEffect } from "react";
import { useMemoStore } from "@/store/v1";
import MemoContent from "..";
import { RendererContext } from "../types";

interface Props {
  memoId: number;
}

const EmbeddedMemo = ({ memoId }: Props) => {
  const context = useContext(RendererContext);
  const memoStore = useMemoStore();
  const memo = memoStore.getMemoById(memoId);
  const resourceName = `memos/${memoId}`;

  useEffect(() => {
    memoStore.getOrFetchMemoById(memoId);
  }, [memoId]);

  if (memoId === context.memoId || context.embeddedMemos.has(resourceName)) {
    return <p>Nested Rendering Error: {`![[${resourceName}]]`}</p>;
  }
  context.embeddedMemos.add(resourceName);

  return (
    <div className="embedded-memo">
      <MemoContent nodes={memo.nodes} memoId={memoId} embeddedMemos={context.embeddedMemos} />
    </div>
  );
};

export default EmbeddedMemo;
