import { useMemoViewContext } from "../MemoViewContext";
import MemoCompleteList from "./MemoCompleteList";

function MemoFooter() {
  const { memo } = useMemoViewContext();
  const hasTaskList = memo.property?.hasTaskList;

  if (!hasTaskList) {
    return null;
  }

  return (
    <footer className="w-full mt-5 flex justify-end items-center">
      <MemoCompleteList />
    </footer>
  );
}

export default MemoFooter;