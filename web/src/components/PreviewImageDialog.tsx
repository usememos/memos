import { useState } from "react";
import * as utils from "../helpers/utils";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import "../less/preview-image-dialog.less";

interface Props extends DialogProps {
  imgUrls: string[];
  initialIndex: number;
}

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrls, initialIndex }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadBtnClick = () => {
    const a = document.createElement("a");
    a.href = imgUrls[currentIndex];
    a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
    a.click();
  };

  const handleImgContainerClick = (event: React.MouseEvent) => {
    if (event.clientX < window.innerWidth / 2) {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else {
        destroy();
      }
    } else {
      if (currentIndex < imgUrls.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        destroy();
      }
    }
  };

  return (
    <>
      <div className="btns-container">
        <button className="btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
        <button className="btn" onClick={handleDownloadBtnClick}>
          <Icon.Download className="icon-img" />
        </button>
      </div>
      <div className="img-container" onClick={handleImgContainerClick}>
        <img onClick={(e) => e.stopPropagation()} src={imgUrls[currentIndex]} />
      </div>
    </>
  );
};

export default function showPreviewImageDialog(imgUrls: string[] | string, initialIndex?: number): void {
  generateDialog(
    {
      className: "preview-image-dialog",
    },
    PreviewImageDialog,
    {
      imgUrls: Array.isArray(imgUrls) ? imgUrls : [imgUrls],
      initialIndex: initialIndex || 0,
    }
  );
}
