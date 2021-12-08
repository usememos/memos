import { showDialog } from "./Dialog";
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
        <p>一个碎片化知识记录工具。</p>
        <br />
        <i>为何做这个？</i>
        <ul>
          <li>
            实践 <strong>卢曼卡片盒笔记法</strong>；
          </li>
          <li>用于记录：📅 每日/周计划、💡 突发奇想、📕 读后感...</li>
          <li>代替了我在微信上经常使用的“文件传输助手”；</li>
          <li>打造一个属于自己的轻量化“卡片”笔记簿；</li>
        </ul>
        <br />
        <i>有何特点呢？</i>
        <ul>
          <li>
            ✨{" "}
            <a target="_blank" href="https://github.com/boojack/insmemo-web" rel="noreferrer">
              开源项目
            </a>
          </li>
          <li>😋 精美且细节的视觉样式；</li>
          <li>📑 体验优良的交互逻辑；</li>
        </ul>
        <br />
        <a target="_blank" href="https://github.com/boojack/insmemo-web/discussions" rel="noreferrer">
          🤔 问题反馈
        </a>
        <br />
        <p>Enjoy it and have fun~ </p>
        <hr />
        <p className="normal-text">
          Last updated on <span className="pre-text">2021/11/26 16:17:44</span> 🎉
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
