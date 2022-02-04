import { useContext, useEffect } from "react";
import appContext from "../stores/appContext";
import useToggle from "../hooks/useToggle";
import useLoading from "../hooks/useLoading";
import Only from "./common/OnlyWhen";
import utils from "../helpers/utils";
import toastHelper from "./Toast";
import { locationService, shortcutService } from "../services";
import showCreateQueryDialog from "./CreateShortcutDialog";
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
  const sortedShortcuts = shortcuts
    .sort((a, b) => utils.getTimeStampByDate(b.createdAt) - utils.getTimeStampByDate(a.createdAt))
    .sort((a, b) => utils.getTimeStampByDate(b.updatedAt) - utils.getTimeStampByDate(a.updatedAt));

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
        <span className="normal-text">快速检索</span>
        <span className="btn" onClick={() => showCreateQueryDialog()}>
          +
        </span>
      </p>
      <Only when={loadingState.isSucceed && sortedShortcuts.length === 0}>
        <div className="create-shortcut-btn-container">
          <span className="btn" onClick={() => showCreateQueryDialog()}>
            创建检索
          </span>
        </div>
      </Only>
      <div className="shortcuts-container">
        {sortedShortcuts.map((s) => {
          return <ShortcutContainer key={s.id} shortcut={s} isActive={s.id === shortcutId} />;
        })}
      </div>
    </div>
  );
};

interface ShortcutContainerProps {
  shortcut: Model.Shortcut;
  isActive: boolean;
}

const ShortcutContainer: React.FC<ShortcutContainerProps> = (props: ShortcutContainerProps) => {
  const { shortcut, isActive } = props;
  const [showActionBtns, toggleShowActionBtns] = useToggle(false);
  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);

  const handleQueryClick = () => {
    if (isActive) {
      locationService.setMemoShortcut("");
    } else {
      if (!["/", "/recycle"].includes(locationService.getState().pathname)) {
        locationService.setPathname("/");
      }
      locationService.setMemoShortcut(shortcut.id);
    }
  };

  const handleShowActionBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleShowActionBtns();
  };

  const handleActionBtnContainerMouseLeave = () => {
    toggleShowActionBtns(false);
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

  const handleEditQueryBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    showCreateQueryDialog(shortcut.id);
  };

  const handlePinQueryBtnClick = async (event: React.MouseEvent) => {
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
          rowStatus: "NORMAL",
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
      <div className={`shortcut-container ${isActive ? "active" : ""}`} onClick={handleQueryClick}>
        <div className="shortcut-text-container">
          <span className="icon-text">#</span>
          <span className="shortcut-text">{shortcut.title}</span>
        </div>
        <div className="btns-container">
          <span className="action-btn toggle-btn" onClick={handleShowActionBtnClick}>
            <img className="icon-img" src={`/icons/more${isActive ? "-white" : ""}.svg`} />
          </span>
          <div className={`action-btns-wrapper ${showActionBtns ? "" : "hidden"}`} onMouseLeave={handleActionBtnContainerMouseLeave}>
            <div className="action-btns-container">
              <span className="btn" onClick={handlePinQueryBtnClick}>
                {shortcut.rowStatus === "ARCHIVED" ? "取消置顶" : "置顶"}
              </span>
              <span className="btn" onClick={handleEditQueryBtnClick}>
                编辑
              </span>
              <span
                className={`btn delete-btn ${showConfirmDeleteBtn ? "final-confirm" : ""}`}
                onClick={handleDeleteMemoClick}
                onMouseLeave={handleDeleteBtnMouseLeave}
              >
                {showConfirmDeleteBtn ? "确定删除！" : "删除"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShortcutList;
