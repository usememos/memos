import { useEffect, useRef } from "react";
import * as api from "../helpers/api";
import { locationService, userService } from "../services";
import toastHelper from "./Toast";
import Only from "./common/OnlyWhen";
import showAboutSiteDialog from "./AboutSiteDialog";
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
    userService
      .doSignOut()
      .then(() => {
        locationService.replaceHistory("/auth");
        window.location.reload();
      })
      .catch(() => {
        // do nth
      });
  };

  return (
    <div className={`menu-btns-popup ${shownStatus ? "" : "hidden"}`} ref={popupElRef}>
      <button className="btn action-btn" onClick={handleAboutBtnClick}>
        <span className="icon">🤠</span> About
      </button>
      <button className="btn action-btn" onClick={handlePingBtnClick}>
        <span className="icon">🎯</span> Ping
      </button>
      <Only when={!userService.isVisitorMode()}>
        <button className="btn action-btn" onClick={handleSignOutBtnClick}>
          <span className="icon">👋</span> Sign out
        </button>
      </Only>
    </div>
  );
};

export default MenuBtnsPopup;
