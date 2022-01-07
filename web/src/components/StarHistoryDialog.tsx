import { showDialog } from "./Dialog";
import "../less/star-history-dialog.less";

interface Props extends DialogProps {}

const StarHistoryDialog: React.FC<Props> = ({ destroy }: Props) => {
  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">⭐️</span>
          <b>Star History</b>
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <iframe
          style={{ width: "100%", height: "auto", minWidth: "600px", minHeight: "400px" }}
          src="https://star-history.com/embed?secret=Z2hwX2Mxa1ZENmMwOXNyc3p3VlpGNm5ibWgxN3NyNUxkazNXTGlTMQ==#justmemos/memos&Date"
          frameBorder="0"
        ></iframe>
      </div>
    </>
  );
};

export default function showStarHistoryDialog(): void {
  showDialog(
    {
      className: "star-history-dialog",
    },
    StarHistoryDialog
  );
}
