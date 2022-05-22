import { useEffect, useRef, useState } from "react";
import * as utils from "../helpers/utils";
import { showDialog } from "./Dialog";
import "../less/preview-image-dialog.less";

interface Props extends DialogProps {
  imgUrl: string;
}

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrl }: Props) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgWidth, setImgWidth] = useState<number>(-1);

  useEffect(() => {
    utils.getImageSize(imgUrl).then(({ width }) => {
      if (width !== 0) {
        setImgWidth(80);
      } else {
        setImgWidth(0);
      }
    });
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDecreaseImageSize = () => {
    if (imgWidth > 30) {
      setImgWidth(imgWidth - 10);
    }
  };

  const handleIncreaseImageSize = () => {
    setImgWidth(imgWidth + 10);
  };

  return (
    <>
      <button className="btn close-btn" onClick={handleCloseBtnClick}>
        <img className="icon-img" src="/icons/close.svg" />
      </button>

      <div className="img-container">
        <img className={imgWidth <= 0 ? "hidden" : ""} ref={imgRef} width={imgWidth + "%"} src={imgUrl} />
        <span className={"loading-text " + (imgWidth === -1 ? "" : "hidden")}>Loading image...</span>
        <span className={"loading-text " + (imgWidth === 0 ? "" : "hidden")}>😟 Failed to load image</span>
      </div>

      <div className="action-btns-container">
        <button className="btn" onClick={handleDecreaseImageSize}>
          ➖
        </button>
        <button className="btn" onClick={handleIncreaseImageSize}>
          ➕
        </button>
        <button className="btn" onClick={() => setImgWidth(80)}>
          ⭕
        </button>
      </div>
    </>
  );
};

export default function showPreviewImageDialog(imgUrl: string): void {
  showDialog(
    {
      className: "preview-image-dialog",
    },
    PreviewImageDialog,
    { imgUrl }
  );
}
