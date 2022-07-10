import { useEffect } from "react";
import { locationService, shortcutService } from "../services";
import { useAppSelector } from "../store";
import * as utils from "../helpers/utils";
import useToggle from "../hooks/useToggle";
import useLoading from "../hooks/useLoading";
import toastHelper from "./Toast";
import showCreateShortcutDialog from "./CreateShortcutDialog";
import "../less/shortcut-list.less";

interface Props {}

const ShortcutList: React.FC<Props> = () => {
  const query = useAppSelector((state) => state.location.query);
  const shortcuts = useAppSelector((state) => state.shortcut.shortcuts);
  const loadingState = useLoading();

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
        <span className="normal-text">Shortcuts</span>
        <button className="btn" onClick={() => showCreateShortcutDialog()}>
          <img src="/icons/add.svg" alt="add shortcut" />
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
        toastHelper.error(error.message);
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
            <img className="icon-img" src="/icons/more.svg" />
          </span>
          <div className="action-btns-wrapper">
            <div className="action-btns-container">
              <span className="btn" onClick={handlePinShortcutBtnClick}>
                {shortcut.rowStatus === "ARCHIVED" ? "Unpin" : "Pin"}
              </span>
              <span className="btn" onClick={handleEditShortcutBtnClick}>
                Edit
              </span>
              <span
                className={`btn delete-btn ${showConfirmDeleteBtn ? "final-confirm" : ""}`}
                onClick={handleDeleteMemoClick}
                onMouseLeave={handleDeleteBtnMouseLeave}
              >
                {showConfirmDeleteBtn ? "Delete!" : "Delete"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShortcutList;
