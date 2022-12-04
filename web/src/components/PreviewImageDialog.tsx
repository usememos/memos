import React, { useState } from "react";
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
  const [imgAngle, setImgAngle] = useState(0);
  const [imgScale, setImgScale] = useState(1);
  const [imgTransformOrigin, setImgTransformOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 5;
  const SCALE_UNIT = 0.5;

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

  const handleImgRotate = (event: React.MouseEvent, angle: number) => {
    const curImgAngle = (imgAngle + angle + 360) % 360;
    setImgAngle(curImgAngle);
  };

  const handleImgContainerScroll = (event: React.WheelEvent) => {
    const offsetX = event.nativeEvent.offsetX;
    const offsetY = event.nativeEvent.offsetY;
    setImgTransformOrigin({
      x: offsetX,
      y: offsetY,
    });
    if (event.deltaY < 0 && imgScale < MAX_SCALE) {
      const enlargeRate = imgScale + SCALE_UNIT;
      setImgScale(enlargeRate);
    } else if (event.deltaY > 0 && imgScale > MIN_SCALE) {
      const shrinkRate = imgScale - SCALE_UNIT;
      setImgScale(shrinkRate);
    }
  };

  const getImageRotateClass = () => {
    return imgAngle === 90 ? "rotate-90" : imgAngle === 180 ? "rotate-180" : imgAngle === 270 ? "rotate-270" : "rotate-0";
  };

  const getImageScaleStyle = () => {
    return {
      transform: `scale(${imgScale})`,
      transformOrigin: `${imgTransformOrigin.x}px ${imgTransformOrigin.y}px`,
    };
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
        <button className="btn" onClick={(e) => handleImgRotate(e, -90)}>
          <Icon.RotateCcw className="icon-img" />
        </button>
        <button className="btn" onClick={(e) => handleImgRotate(e, 90)}>
          <Icon.RotateCw className="icon-img" />
        </button>
      </div>
      <div className="img-container" onClick={handleImgContainerClick}>
        <img
          onClick={(e) => e.stopPropagation()}
          src={imgUrls[currentIndex]}
          onWheel={handleImgContainerScroll}
          className={`${getImageRotateClass()}`}
          style={getImageScaleStyle()}
        />
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
