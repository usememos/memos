import MemoEditor from "../components/MemoEditor";
import MemosHeader from "../components/MemosHeader";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import "../less/memos.less";

function Memos() {
  return (
    <main className="memos-wrapper">
      <div className="memo-editor-wrapper">
        <MemoEditor />
      </div>
      <div className="memo-list-wrapper">
        <MemosHeader />
        <MemoFilter />
        <MemoList />
      </div>
    </main>
  );
}

export default Memos;
