import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getMemoStats } from "../helpers/api";
import * as utils from "../helpers/utils";
import userService from "../services/userService";
import { locationService } from "../services";
import { useAppSelector } from "../store";
import Icon from "./Icon";
import Dropdown from "./common/Dropdown";
import showResourcesDialog from "./ResourcesDialog";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import showAboutSiteDialog from "./AboutSiteDialog";
import "../less/user-banner.less";

const UserBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, owner } = useAppSelector((state) => state.user);
  const { memos, tags } = useAppSelector((state) => state.memo);
  const [username, setUsername] = useState("Memos");
  const [memoAmount, setMemoAmount] = useState(0);
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
  }, [isVisitorMode, user, owner]);

  useEffect(() => {
    getMemoStats(userService.getCurrentUserId())
      .then(({ data: { data } }) => {
        setMemoAmount(data.length);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [memos]);

  const handleUsernameClick = useCallback(() => {
    locationService.clearQuery();
  }, []);

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
    userService.doSignOut().catch();
    navigate("/auth");
  };

  return (
    <>
      <div className="user-banner-container">
        <div className="username-container" onClick={handleUsernameClick}>
          <span className="username-text">{username}</span>
          {!isVisitorMode && user?.role === "HOST" ? <span className="tag">MOD</span> : null}
        </div>
        <Dropdown
          trigger={<Icon.MoreHorizontal className="ml-2 w-5 h-auto cursor-pointer" />}
          actionsClassName="!w-36"
          actions={
            <>
              {!userService.isVisitorMode() && (
                <>
                  <button
                    className="w-full px-3 whitespace-nowrap text-left leading-10 cursor-pointer rounded hover:bg-gray-100"
                    onClick={handleResourcesBtnClick}
                  >
                    <span className="mr-1">🌄</span> {t("sidebar.resources")}
                  </button>
                  <button
                    className="w-full px-3 whitespace-nowrap text-left leading-10 cursor-pointer rounded hover:bg-gray-100"
                    onClick={handleArchivedBtnClick}
                  >
                    <span className="mr-1">🗂</span> {t("sidebar.archived")}
                  </button>
                </>
              )}
              <button
                className="w-full px-3 whitespace-nowrap text-left leading-10 cursor-pointer rounded hover:bg-gray-100"
                onClick={handleAboutBtnClick}
              >
                <span className="mr-1">🤠</span> {t("common.about")}
              </button>
              {!userService.isVisitorMode() && (
                <button
                  className="w-full px-3 whitespace-nowrap text-left leading-10 cursor-pointer rounded hover:bg-gray-100"
                  onClick={handleSignOutBtnClick}
                >
                  <span className="mr-1">👋</span> {t("common.sign-out")}
                </button>
              )}
            </>
          }
        />
      </div>
      <div className="amount-text-container">
        <div className="status-text memos-text">
          <span className="amount-text">{memoAmount}</span>
          <span className="type-text">{t("amount-text.memo")}</span>
        </div>
        <div className="status-text tags-text">
          <span className="amount-text">{tags.length}</span>
          <span className="type-text">{t("amount-text.tag")}</span>
        </div>
        <div className="status-text duration-text">
          <span className="amount-text">{createdDays}</span>
          <span className="type-text">{t("amount-text.day")}</span>
        </div>
      </div>
    </>
  );
};

export default UserBanner;
