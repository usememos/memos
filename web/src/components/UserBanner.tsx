import { useCallback, useState } from "react";
import { useAppSelector } from "../store";
import { locationService } from "../services";
import MenuBtnsPopup from "./MenuBtnsPopup";
import "../less/user-banner.less";

interface Props {}

const UserBanner: React.FC<Props> = () => {
  const user = useAppSelector((state) => state.user.user);
  const [shouldShowPopupBtns, setShouldShowPopupBtns] = useState(false);

  const username = user ? user.name : "Memos";

  const handleUsernameClick = useCallback(() => {
    locationService.pushHistory("/");
    locationService.clearQuery();
  }, []);

  const handlePopupBtnClick = () => {
    setShouldShowPopupBtns(true);
  };

  return (
    <div className="user-banner-container">
      <div className="username-container" onClick={handleUsernameClick}>
        <span className="username-text">{username}</span>
        {user?.role === "OWNER" ? <span className="tag">MOD</span> : null}
      </div>
      <span className="action-btn menu-popup-btn" onClick={handlePopupBtnClick}>
        <img src="/icons/more.svg" className="icon-img" />
      </span>
      <MenuBtnsPopup shownStatus={shouldShowPopupBtns} setShownStatus={setShouldShowPopupBtns} />
    </div>
  );
};

export default UserBanner;
