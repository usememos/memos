import { useEffect, useRef, useState } from "react";
import { userService } from "../services";
import toImage from "../labs/html2image";
import { ANIMATION_DURATION, IMAGE_URL_REG } from "../helpers/consts";
import * as utils from "../helpers/utils";
import { formatMemoContent } from "../helpers/marked";
import Only from "./common/OnlyWhen";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/share-memo-image-dialog.less";

interface Props extends DialogProps {
  memo: Memo;
}

const ShareMemoImageDialog: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo, destroy } = props;
  const { user: userinfo } = userService.getState();
  const memo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdTs),
  };
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));

  const [shortcutImgUrl, setShortcutImgUrl] = useState("");
  const [imgAmount, setImgAmount] = useState(imageUrls.length);
  const memoElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imgAmount > 0) {
      return;
    }

    setTimeout(() => {
      if (!memoElRef.current) {
        return;
      }

      toImage(memoElRef.current, {
        backgroundColor: "#eaeaea",
        pixelRatio: window.devicePixelRatio * 2,
      })
        .then((url) => {
          setShortcutImgUrl(url);
        })
        .catch(() => {
          // do nth
        });
    }, ANIMATION_DURATION);
  }, [imgAmount]);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleImageOnLoad = (ev: React.SyntheticEvent<HTMLImageElement>) => {
    if (ev.type === "error") {
      toastHelper.error("😟 Image load failed");
      (ev.target as HTMLImageElement).remove();
    }
    setImgAmount(imgAmount - 1);
  };

  const handleDownloadBtnClick = () => {
    const a = document.createElement("a");
    a.href = shortcutImgUrl;
    a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
    a.click();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🌄</span>Share Memo
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className={`tip-words-container ${shortcutImgUrl ? "finish" : "loading"}`}>
          <p className="tip-text">{shortcutImgUrl ? "Click to save the image 👇" : "Generating the screenshot..."}</p>
        </div>
        <div className="memo-container" ref={memoElRef}>
          <Only when={shortcutImgUrl !== ""}>
            <img className="memo-shortcut-img" onClick={handleDownloadBtnClick} src={shortcutImgUrl} />
          </Only>
          <span className="time-text">{memo.createdAtStr}</span>
          <div className="memo-content-text" dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}></div>
          <Only when={imageUrls.length > 0}>
            <div className="images-container">
              {imageUrls.map((imgUrl, idx) => (
                <img decoding="async" key={idx} src={imgUrl} onLoad={handleImageOnLoad} onError={handleImageOnLoad} />
              ))}
            </div>
          </Only>
          <div className="watermark-container">
            <span className="normal-text">
              <span className="icon-text">✍️</span> by <span className="name-text">{userinfo?.name}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default function showShareMemoImageDialog(memo: Memo): void {
  generateDialog(
    {
      className: "share-memo-image-dialog",
    },
    ShareMemoImageDialog,
    { memo }
  );
}
