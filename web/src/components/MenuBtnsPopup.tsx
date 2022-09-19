import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { userService } from "../services";
import Only from "./common/OnlyWhen";
import showAboutSiteDialog from "./AboutSiteDialog";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import showResourcesDialog from "./ResourcesDialog";
import "../less/menu-btns-popup.less";

interface Props {
  shownStatus: boolean;
  setShownStatus: (status: boolean) => void;
}

const MenuBtnsPopup: React.FC<Props> = (props: Props) => {
  const { shownStatus, setShownStatus } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const handleResourcesBtnClick = () => {
    showResourcesDialog();
  };

  const handleArchivedBtnClick = () => {
    showArchivedMemoDialog();
  };

  const handleAboutBtnClick = () => {
    showAboutSiteDialog();
  };

  const handleSignOutBtnClick = async () => {
    userService
      .doSignOut()
      .then(() => {
        navigate("/auth");
      })
      .catch(() => {
        // do nth
      });
  };

  return (
    <div className={`menu-btns-popup ${shownStatus ? "" : "hidden"}`} ref={popupElRef}>
      <Only when={!userService.isVisitorMode()}>
        <button className="btn action-btn" onClick={handleResourcesBtnClick}>
          <span className="icon">🌄</span> {t("sidebar.resources")}
        </button>
        <button className="btn action-btn" onClick={handleArchivedBtnClick}>
          <span className="icon">🗂</span> {t("sidebar.archived")}
        </button>
      </Only>
      <button className="btn action-btn" onClick={handleAboutBtnClick}>
        <span className="icon">🤠</span> {t("common.about")}
      </button>
      <Only when={!userService.isVisitorMode()}>
        <button className="btn action-btn" onClick={handleSignOutBtnClick}>
          <span className="icon">👋</span> {t("common.sign-out")}
        </button>
      </Only>
    </div>
  );
};

export default MenuBtnsPopup;
