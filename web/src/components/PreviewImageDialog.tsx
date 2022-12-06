import React, { useState } from "react";
import * as utils from "../helpers/utils";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import "../less/preview-image-dialog.less";

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const SCALE_UNIT = 0.25;

interface Props extends DialogProps {
  imgUrls: string[];
  initialIndex: number;
}

interface State {
  angle: number;
  scale: number;
  originX: number;
  originY: number;
}

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrls, initialIndex }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [state, setState] = useState<State>({
    angle: 0,
    scale: 1,
    originX: -1,
    originY: -1,
  });

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
    const curImgAngle = (state.angle + angle + 360) % 360;
    setState({
      ...state,
      originX: -1,
      originY: -1,
      angle: curImgAngle,
    });
  };

  const handleImgContainerScroll = (event: React.WheelEvent) => {
    const offsetX = event.nativeEvent.offsetX;
    const offsetY = event.nativeEvent.offsetY;
    const sign = event.deltaY < 0 ? 1 : -1;
    const curAngle = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale + sign * SCALE_UNIT));
    setState({
      ...state,
      originX: offsetX,
      originY: offsetY,
      scale: curAngle,
    });
  };

  const getImageComputedStyle = () => {
    return {
      transform: `scale(${state.scale}) rotate(${state.angle}deg)`,
      transformOrigin: `${state.originX === -1 ? "center" : `${state.originX}px`} ${
        state.originY === -1 ? "center" : `${state.originY}px`
      }`,
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
          style={getImageComputedStyle()}
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
