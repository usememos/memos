import { useEffect, useState } from "react";
import { userService } from "../services";
import { showDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/change-password-dialog.less";

interface Props extends DialogProps {}

const BindWxUserIdDialog: React.FC<Props> = ({ destroy }: Props) => {
  const [wxUserId, setWxUserId] = useState("");

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleWxUserIdChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setWxUserId(text);
  };

  const handleSaveBtnClick = async () => {
    if (wxUserId === "") {
      toastHelper.error("微信 id 不能为空");
      return;
    }

    try {
      await userService.updateWxUserId(wxUserId);
      userService.doSignIn();
      toastHelper.info("绑定成功！");
      handleCloseBtnClick();
    } catch (error: any) {
      toastHelper.error(error);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">绑定微信 OpenID</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="tip-text">
          关注微信公众号“小谈闲事”，主动发送任意消息，即可获取 <strong>OpenID</strong> 。
        </p>
        <label className="form-label input-form-label">
          <span className={"normal-text " + (wxUserId === "" ? "" : "not-null")}>微信 OpenID</span>
          <input type="text" value={wxUserId} onChange={handleWxUserIdChanged} />
        </label>
        <div className="btns-container">
          <span className="btn cancel-btn" onClick={handleCloseBtnClick}>
            取消
          </span>
          <span className="btn confirm-btn" onClick={handleSaveBtnClick}>
            保存
          </span>
        </div>
      </div>
    </>
  );
};

function showBindWxUserIdDialog() {
  showDialog(
    {
      className: "bind-wxid-dialog",
    },
    BindWxUserIdDialog
  );
}

export default showBindWxUserIdDialog;
