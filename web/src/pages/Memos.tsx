import MemoEditor from "../components/MemoEditor";
import MemosHeader from "../components/MemosHeader";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";

function Memos() {
  return (
    <>
      <MemosHeader />
      <MemoEditor />
      <MemoFilter />
      <MemoList />
    </>
  );
}

export default Memos;
