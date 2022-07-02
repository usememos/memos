import { useAppSelector } from "../store";
import * as utils from "../helpers/utils";
import showDailyReviewDialog from "./DailyReviewDialog";
import showSettingDialog from "./SettingDialog";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import UserBanner from "./UserBanner";
import UsageHeatMap from "./UsageHeatMap";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import "../less/siderbar.less";

interface Props {}

const Sidebar: React.FC<Props> = () => {
  const { memos, tags } = useAppSelector((state) => state.memo);
  const user = useAppSelector((state) => state.user.user);

  const createdDays = user ? Math.ceil((Date.now() - utils.getTimeStampByDate(user.createdTs)) / 1000 / 3600 / 24) : 0;

  const handleMyAccountBtnClick = () => {
    showSettingDialog();
  };

  const handleArchivedBtnClick = () => {
    showArchivedMemoDialog();
  };

  return (
    <aside className="sidebar-wrapper">
      <div className="close-container">
        <span className="action-btn" onClick={toggleSiderbar}>
          <img src="/icons/close.svg" className="icon-img" alt="" />
        </span>
      </div>
      <UserBanner />
      <div className="status-text-container">
        <div className="status-text memos-text">
          <span className="amount-text">{memos.length}</span>
          <span className="type-text">MEMO</span>
        </div>
        <div className="status-text tags-text">
          <span className="amount-text">{tags.length}</span>
          <span className="type-text">TAG</span>
        </div>
        <div className="status-text duration-text">
          <span className="amount-text">{createdDays}</span>
          <span className="type-text">DAY</span>
        </div>
      </div>
      <UsageHeatMap />
      <div className="action-btns-container">
        <button className="btn action-btn" onClick={() => showDailyReviewDialog()}>
          <span className="icon">📅</span> Daily Review
        </button>
        <button className="btn action-btn" onClick={handleMyAccountBtnClick}>
          <span className="icon">⚙️</span> Setting
        </button>
        <button className="btn action-btn" onClick={handleArchivedBtnClick}>
          <span className="icon">🗂</span> Archived
        </button>
      </div>
      <ShortcutList />
      <TagList />
    </aside>
  );
};

export const toggleSiderbar = () => {
  const sidebarEl = document.body.querySelector(".sidebar-wrapper") as HTMLDivElement;
  const display = window.getComputedStyle(sidebarEl).display;
  if (display === "none") {
    sidebarEl.style.display = "flex";
  } else {
    sidebarEl.style.display = "none";
  }
};

export default Sidebar;
