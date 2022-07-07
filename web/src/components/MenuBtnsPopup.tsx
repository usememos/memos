import { useEffect, useRef } from "react";
import * as api from "../helpers/api";
import { locationService, userService } from "../services";
import showAboutSiteDialog from "./AboutSiteDialog";
import toastHelper from "./Toast";
import "../less/menu-btns-popup.less";

interface Props {
  shownStatus: boolean;
  setShownStatus: (status: boolean) => void;
}

const MenuBtnsPopup: React.FC<Props> = (props: Props) => {
  const { shownStatus, setShownStatus } = props;
  const popupElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shownStatus) {
      const handleClickOutside = (event: MouseEvent) => {
        if (!popupElRef.current?.contains(event.target as Node)) {
          event.stopPropagation();
        }
        setShownStatus(false);
      };
      window.addEventListener("click", handleClickOutside, {
        capture: true,
        once: true,
      });
    }
  }, [shownStatus]);

  const handlePingBtnClick = () => {
    api
      .getSystemStatus()
      .then(({ data }) => {
        const {
          data: { profile },
        } = data;
        toastHelper.info(JSON.stringify(profile, null, 4));
      })
      .catch((error) => {
        toastHelper.error("Failed to ping\n" + JSON.stringify(error, null, 4));
      });
  };

  const handleAboutBtnClick = () => {
    showAboutSiteDialog();
  };

  const handleSignOutBtnClick = async () => {
    userService.doSignOut().catch(() => {
      // do nth
    });
    locationService.replaceHistory("/signin");
    window.location.reload();
  };

  const handleSignInBtnClick = async () => {
    locationService.replaceHistory("/signin");
  };

  return (
    <div className={`menu-btns-popup ${shownStatus ? "" : "hidden"}`} ref={popupElRef}>
      <button className="btn action-btn" onClick={handleAboutBtnClick}>
        <span className="icon">🤠</span> About
      </button>
      <button className="btn action-btn" onClick={handlePingBtnClick}>
        <span className="icon">🎯</span> Ping
      </button>
      <button className="btn action-btn" onClick={userService.isNotVisitor() ? handleSignOutBtnClick : handleSignInBtnClick}>
        <span className="icon">👋</span> {userService.isNotVisitor() ? "Sign out" : "Sign in"}
      </button>
    </div>
  );
};

export default MenuBtnsPopup;
