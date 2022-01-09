import { useEffect } from "react";
import { showDialog } from "./Dialog";
import useLoading from "../hooks/useLoading";
import toastHelper from "./Toast";
import { userService } from "../services";
import "../less/confirm-reset-openid-dialog.less";

interface Props extends DialogProps {}

const ConfirmResetOpenIdDialog: React.FC<Props> = ({ destroy }: Props) => {
  const resetBtnClickLoadingState = useLoading(false);

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    if (resetBtnClickLoadingState.isLoading) {
      return;
    }

    resetBtnClickLoadingState.setLoading();
    try {
      await userService.resetOpenId();
    } catch (error) {
      toastHelper.error("请求重置 Open API 失败");
      return;
    }
    toastHelper.success("重置成功！");
    handleCloseBtnClick();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">重置 Open API</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="warn-text">⚠️ 现有 API 将失效，并生成新的 API，确定要重置吗?</p>
        <div className="btns-container">
          <span className="btn cancel-btn" onClick={handleCloseBtnClick}>
            取消
          </span>
          <span className={`btn confirm-btn ${resetBtnClickLoadingState.isLoading ? "loading" : ""}`} onClick={handleConfirmBtnClick}>
            确定重置！
          </span>
        </div>
      </div>
    </>
  );
};

function showConfirmResetOpenIdDialog() {
  showDialog(
    {
      className: "confirm-reset-openid-dialog",
    },
    ConfirmResetOpenIdDialog
  );
}

export default showConfirmResetOpenIdDialog;
