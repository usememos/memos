import { useCallback, useEffect, useState } from "react";
import * as api from "../helpers/api";
import userService from "../services/userService";
import { locationService } from "../services";
import { useAppSelector } from "../store";
import toastHelper from "./Toast";
import MenuBtnsPopup from "./MenuBtnsPopup";
import "../less/user-banner.less";

interface Props {}

const UserBanner: React.FC<Props> = () => {
  const user = useAppSelector((state) => state.user.user);
  const [shouldShowPopupBtns, setShouldShowPopupBtns] = useState(false);
  const [username, setUsername] = useState("Memos");
  const isVisitorMode = userService.isVisitorMode();

  useEffect(() => {
    const currentUserId = userService.getUserIdFromPath();
    if (isVisitorMode && currentUserId) {
      api
        .getUserNameById(currentUserId)
        .then(({ data }) => {
          const { data: username } = data;
          if (username) {
            setUsername(username);
          }
        })
        .catch(() => {
          toastHelper.error("User not found");
        });
    } else if (user) {
      setUsername(user.name);
    }
  }, []);

  const handleUsernameClick = useCallback(() => {
    locationService.clearQuery();
  }, []);

  const handlePopupBtnClick = () => {
    setShouldShowPopupBtns(true);
  };

  return (
    <div className="user-banner-container">
      <div className="username-container" onClick={handleUsernameClick}>
        <span className="username-text">{username}</span>
        {!isVisitorMode && user?.role === "HOST" ? <span className="tag">MOD</span> : null}
      </div>
      <span className="action-btn menu-popup-btn" onClick={handlePopupBtnClick}>
        <img src="/icons/more.svg" className="icon-img" />
      </span>
      <MenuBtnsPopup shownStatus={shouldShowPopupBtns} setShownStatus={setShouldShowPopupBtns} />
    </div>
  );
};

export default UserBanner;
