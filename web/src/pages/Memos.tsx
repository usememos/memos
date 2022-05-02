import MemoEditor from "../components/MemoEditor";
import MemosHeader from "../components/MemosHeader";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import "../less/memos.less";

function Memos() {
  return (
    <main className="memos-wrapper">
      <MemosHeader />
      <MemoEditor />
      <MemoFilter />
      <MemoList />
    </main>
  );
}

export default Memos;
