import { useCallback, useContext, useState } from "react";
import appContext from "../stores/appContext";
import { locationService } from "../services";
import MenuBtnsPopup from "./MenuBtnsPopup";
import "../less/user-banner.less";

interface Props {}

const UserBanner: React.FC<Props> = () => {
  const {
    userState: { user },
  } = useContext(appContext);
  const username = user ? user.name : "Memos";

  const [shouldShowPopupBtns, setShouldShowPopupBtns] = useState(false);

  const handleUsernameClick = useCallback(() => {
    locationService.pushHistory("/");
    locationService.clearQuery();
  }, []);

  const handlePopupBtnClick = () => {
    const sidebarEl = document.querySelector(".sidebar-wrapper") as HTMLElement;
    const popupEl = document.querySelector(".menu-btns-popup") as HTMLElement;
    popupEl.style.top = 54 - sidebarEl.scrollTop + "px";
    setShouldShowPopupBtns(true);
  };

  return (
    <div className="user-banner-container">
      <p className="username-text" onClick={handleUsernameClick}>
        {username}
      </p>
      <span className="action-btn menu-popup-btn" onClick={handlePopupBtnClick}>
        <img src="/icons/more.svg" className="icon-img" />
      </span>
      <MenuBtnsPopup shownStatus={shouldShowPopupBtns} setShownStatus={setShouldShowPopupBtns} />
    </div>
  );
};

export default UserBanner;
