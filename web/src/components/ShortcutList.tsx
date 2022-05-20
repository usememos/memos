import { useContext, useEffect } from "react";
import { locationService, shortcutService } from "../services";
import appContext from "../stores/appContext";
import { UNKNOWN_ID } from "../helpers/consts";
import utils from "../helpers/utils";
import useToggle from "../hooks/useToggle";
import useLoading from "../hooks/useLoading";
import toastHelper from "./Toast";
import showCreateShortcutDialog from "./CreateShortcutDialog";
import "../less/shortcut-list.less";

interface Props {}

const ShortcutList: React.FC<Props> = () => {
  const {
    shortcutState: { shortcuts },
    locationState: {
      query: { shortcutId },
    },
  } = useContext(appContext);
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
        <span className="btn" onClick={() => showCreateShortcutDialog()}>
          <img src="/icons/add.svg" alt="add shortcut" />
        </span>
      </p>
      <div className="shortcuts-container">
        {sortedShortcuts.map((s) => {
          return <ShortcutContainer key={s.id} shortcut={s} isActive={s.id === Number(shortcutId)} />;
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
      locationService.setMemoShortcut(UNKNOWN_ID);
    } else {
      if (!["/"].includes(locationService.getState().pathname)) {
        locationService.setPathname("/");
      }
      locationService.setMemoShortcut(shortcut.id);
    }
  };

  const handleDeleteMemoClick = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (showConfirmDeleteBtn) {
      try {
        await shortcutService.deleteShortcut(shortcut.id);
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
      if (shortcut.rowStatus === "ARCHIVED") {
        await shortcutService.unpinShortcut(shortcut.id);
        shortcutService.editShortcut({
          ...shortcut,
          rowStatus: "NORMAL",
        });
      } else {
        await shortcutService.pinShortcut(shortcut.id);
        shortcutService.editShortcut({
          ...shortcut,
          rowStatus: "ARCHIVED",
        });
      }
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
          {/* <span className="icon-text">#</span> */}
          <span className="shortcut-text">{shortcut.title}</span>
        </div>
        <div className="btns-container">
          <span className="action-btn toggle-btn">
            <img className="icon-img" src={`/icons/more${isActive ? "-white" : ""}.svg`} />
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
