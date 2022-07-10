import { useCallback, useEffect, useState } from "react";
import * as utils from "../helpers/utils";
import userService from "../services/userService";
import { locationService } from "../services";
import { useAppSelector } from "../store";
import MenuBtnsPopup from "./MenuBtnsPopup";
import "../less/user-banner.less";

interface Props {}

const UserBanner: React.FC<Props> = () => {
  const { user, owner } = useAppSelector((state) => state.user);
  const { memos, tags } = useAppSelector((state) => state.memo);
  const [shouldShowPopupBtns, setShouldShowPopupBtns] = useState(false);
  const [username, setUsername] = useState("Memos");
  const [createdDays, setCreatedDays] = useState(0);
  const isVisitorMode = userService.isVisitorMode();

  useEffect(() => {
    if (isVisitorMode) {
      if (!owner) {
        return;
      }
      setUsername(owner.name);
      setCreatedDays(Math.ceil((Date.now() - utils.getTimeStampByDate(owner.createdTs)) / 1000 / 3600 / 24));
    } else if (user) {
      setUsername(user.name);
      setCreatedDays(Math.ceil((Date.now() - utils.getTimeStampByDate(user.createdTs)) / 1000 / 3600 / 24));
    }
  }, []);

  const handleUsernameClick = useCallback(() => {
    locationService.clearQuery();
  }, []);

  const handlePopupBtnClick = () => {
    setShouldShowPopupBtns(true);
  };

  return (
    <>
      <div className="user-banner-container">
        <div className="username-container" onClick={handleUsernameClick}>
          <span className="username-text">{username}</span>
          {!isVisitorMode && user?.role === "HOST" ? <span className="tag">MOD</span> : null}
        </div>
        <button className="action-btn menu-popup-btn" onClick={handlePopupBtnClick}>
          <img src="/icons/more.svg" className="icon-img" />
        </button>
        <MenuBtnsPopup shownStatus={shouldShowPopupBtns} setShownStatus={setShouldShowPopupBtns} />
      </div>
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
    </>
  );
};

export default UserBanner;
