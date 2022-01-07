import { showDialog } from "./Dialog";
import showStarHistoryDialog from "./StarHistoryDialog";
import "../less/about-site-dialog.less";

interface Props extends DialogProps {}

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🤠</span>关于 <b>Memos</b>
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <p>
          把玩 <a href="https://flomoapp.com">flomo</a> 后有感而作的开源项目
        </p>
        <p>特点：精美且细节的视觉样式、体验优良的交互逻辑</p>
        <br />
        <p>
          🏗 This project is working in progress, <br /> and very pleasure to welcome your{" "}
          <a href="https://github.com/justmemos/memos/issues">issues</a> and <a href="https://github.com/justmemos/memos/pulls">PR</a>.
        </p>
        <br />
        <span className="btn" onClick={showStarHistoryDialog}>
          Star History
        </span>
        <hr />
        <p className="normal-text">
          Last updated on <span className="pre-text">2021/12/12 14:38:15</span> 🎉
        </p>
      </div>
    </>
  );
};

export default function showAboutSiteDialog(): void {
  showDialog(
    {
      className: "about-site-dialog",
    },
    AboutSiteDialog
  );
}
