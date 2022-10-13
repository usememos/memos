import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { locationService, shortcutService } from "../services";
import { useAppSelector } from "../store";
import * as utils from "../helpers/utils";
import useToggle from "../hooks/useToggle";
import useLoading from "../hooks/useLoading";
import Icon from "./Icon";
import toastHelper from "./Toast";
import showCreateShortcutDialog from "./CreateShortcutDialog";
import "../less/shortcut-list.less";

const ShortcutList = () => {
  const query = useAppSelector((state) => state.location.query);
  const shortcuts = useAppSelector((state) => state.shortcut.shortcuts);
  const loadingState = useLoading();
  const { t } = useTranslation();

  const pinnedShortcuts = shortcuts
    .filter((s) => s.rowStatus === "ARCHIVED")
    .sort((a, b) => utils.getTimeStampByDate(b.createdTs) - utils.getTimeStampByDate(a.createdTs));
  const unpinnedShortcuts = shortcuts
    .filter((s) => s.rowStatus === "NORMAL")
    .sort((a, b) => utils.getTimeStampByDate(b.createdTs) - utils.getTimeStampByDate(a.createdTs));
  const sortedShortcuts = pinnedShortcuts.concat(unpinnedShortcuts);

  useEffect(() => {
    shortcutService
      .getMyAllShortcuts()
      .catch(() => {
        // do nth
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  return (
    <div className="shortcuts-wrapper">
      <p className="title-text">
        <span className="normal-text">{t("common.shortcuts")}</span>
        <button className="btn" onClick={() => showCreateShortcutDialog()}>
          <Icon.Plus className="icon-img" />
        </button>
      </p>
      <div className="shortcuts-container">
        {sortedShortcuts.map((s) => {
          return <ShortcutContainer key={s.id} shortcut={s} isActive={s.id === Number(query?.shortcutId)} />;
        })}
      </div>
    </div>
  );
};

interface ShortcutContainerProps {
  shortcut: Shortcut;
  isActive: boolean;
}

const ShortcutContainer: React.FC<ShortcutContainerProps> = (props: ShortcutContainerProps) => {
  const { shortcut, isActive } = props;
  const { t } = useTranslation();
  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);

  const handleShortcutClick = () => {
    if (isActive) {
      locationService.setMemoShortcut(undefined);
    } else {
      locationService.setMemoShortcut(shortcut.id);
    }
  };

  const handleDeleteMemoClick = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (showConfirmDeleteBtn) {
      try {
        await shortcutService.deleteShortcutById(shortcut.id);
      } catch (error: any) {
        console.error(error);
        toastHelper.error(error.response.data.message);
      }
    } else {
      toggleConfirmDeleteBtn();
    }
  };

  const handleEditShortcutBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    showCreateShortcutDialog(shortcut.id);
  };

  const handlePinShortcutBtnClick = async (event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      const shortcutPatch: ShortcutPatch = {
        id: shortcut.id,
        rowStatus: shortcut.rowStatus === "ARCHIVED" ? "NORMAL" : "ARCHIVED",
      };
      await shortcutService.patchShortcut(shortcutPatch);
    } catch (error) {
      // do nth
    }
  };

  const handleDeleteBtnMouseLeave = () => {
    toggleConfirmDeleteBtn(false);
  };

  return (
    <>
      <div className={`shortcut-container ${isActive ? "active" : ""}`} onClick={handleShortcutClick}>
        <div className="shortcut-text-container">
          <span className="shortcut-text">{shortcut.title}</span>
        </div>
        <div className="btns-container">
          <span className="action-btn toggle-btn">
            <Icon.MoreHorizontal className="icon-img" />
          </span>
          <div className="action-btns-wrapper">
            <div className="action-btns-container">
              <span className="btn" onClick={handlePinShortcutBtnClick}>
                {shortcut.rowStatus === "ARCHIVED" ? t("common.unpin") : t("common.pin")}
              </span>
              <span className="btn" onClick={handleEditShortcutBtnClick}>
                {t("common.edit")}
              </span>
              <span
                className={`btn delete-btn ${showConfirmDeleteBtn ? "final-confirm" : ""}`}
                onClick={handleDeleteMemoClick}
                onMouseLeave={handleDeleteBtnMouseLeave}
              >
                {t("common.delete")}
                {showConfirmDeleteBtn ? "!" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShortcutList;
