import * as api from "../helpers/api";
import { useCallback, useEffect, useState } from "react";
import MenuBtnsPopup from "./MenuBtnsPopup";
import { getUserIdFromPath } from "../services/userService";
import { locationService } from "../services";
import toastHelper from "./Toast";
import { useAppSelector } from "../store";
import "../less/user-banner.less";

interface Props {}

const UserBanner: React.FC<Props> = () => {
  const user = useAppSelector((state) => state.user.user);
  const [shouldShowPopupBtns, setShouldShowPopupBtns] = useState(false);

  const [username, setUsername] = useState(user ? user.name : "Memos");

  const handleUsernameClick = useCallback(() => {
    locationService.clearQuery();
  }, []);

  const handlePopupBtnClick = () => {
    setShouldShowPopupBtns(true);
  };

  useEffect(() => {
    if (username === "Memos") {
      if (locationService.getState().pathname === "/") {
        api.getSystemStatus().then(({ data }) => {
          const { data: status } = data;
          setUsername(status.owner.name);
        });
      } else {
        api
          .getUserNameById(Number(getUserIdFromPath()))
          .then(({ data }) => {
            const { data: username } = data;
            setUsername(username);
          })
          .catch(() => {
            toastHelper.error("User not found");
          });
      }
    }
  }, []);

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
