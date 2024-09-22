import { XIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { generateDialog } from "./Dialog";
import "@/less/preview-image-dialog.less";

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const SCALE_UNIT = 0.25;

interface Props extends DialogProps {
  imgUrls: string[];
  initialIndex: number;
}

interface State {
  scale: number;
  originX: number;
  originY: number;
}

const defaultState: State = {
  scale: 1,
  originX: -1,
  originY: -1,
};

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrls, initialIndex }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [state, setState] = useState<State>(defaultState);
  let startX = -1;
  let endX = -1;

  const handleCloseBtnClick = () => {
    destroyAndResetViewport();
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length > 1) {
      // two or more fingers, ignore
      return;
    }
    startX = event.touches[0].clientX;
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length > 1) {
      // two or more fingers, ignore
      return;
    }
    endX = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length > 1) {
      // two or more fingers, ignore
      return;
    }
    if (startX > -1 && endX > -1) {
      const distance = startX - endX;
      if (distance > 50) {
        showNextImg();
      } else if (distance < -50) {
        showPrevImg();
      }
    }

    endX = -1;
    startX = -1;
  };

  const showPrevImg = () => {
    if (currentIndex > 0) {
      setState(defaultState);
      setCurrentIndex(currentIndex - 1);
    } else {
      destroyAndResetViewport();
    }
  };

  const showNextImg = () => {
    if (currentIndex < imgUrls.length - 1) {
      setState(defaultState);
      setCurrentIndex(currentIndex + 1);
    } else {
      destroyAndResetViewport();
    }
  };

  const handleImgContainerClick = (event: React.MouseEvent) => {
    if (event.clientX < window.innerWidth / 2) {
      showPrevImg();
    } else {
      showNextImg();
    }
  };

  const handleImgContainerScroll = (event: React.WheelEvent) => {
    const offsetX = event.nativeEvent.offsetX;
    const offsetY = event.nativeEvent.offsetY;
    const sign = event.deltaY < 0 ? 1 : -1;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale + sign * SCALE_UNIT));
    setState({
      ...state,
      originX: offsetX,
      originY: offsetY,
      scale: scale,
    });
  };

  const setViewportScalable = () => {
    const viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
      const contentAttrs = viewport.getAttribute("content");
      if (contentAttrs) {
        viewport.setAttribute("content", contentAttrs.replace("user-scalable=no", "user-scalable=yes"));
      }
    }
  };

  const destroyAndResetViewport = () => {
    const viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
      const contentAttrs = viewport.getAttribute("content");
      if (contentAttrs) {
        viewport.setAttribute("content", contentAttrs.replace("user-scalable=yes", "user-scalable=no"));
      }
    }
    destroy();
  };

  const imageComputedStyle = {
    transform: `scale(${state.scale})`,
    transformOrigin: `${state.originX === -1 ? "center" : `${state.originX}px`} ${state.originY === -1 ? "center" : `${state.originY}px`}`,
  };

  useEffect(() => {
    setViewportScalable();
  }, []);

  return (
    <>
      <div className="btns-container">
        <button className="btn" onClick={handleCloseBtnClick}>
          <XIcon className="icon-img" />
        </button>
      </div>
      <div className="img-container" onClick={handleImgContainerClick}>
        <img
          style={imageComputedStyle}
          src={imgUrls[currentIndex]}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleImgContainerScroll}
          decoding="async"
          loading="lazy"
        />
      </div>
    </>
  );
};

export default function showPreviewImageDialog(imgUrls: string[] | string, initialIndex?: number): void {
  generateDialog(
    {
      className: "preview-image-dialog",
      dialogName: "preview-image-dialog",
    },
    PreviewImageDialog,
    {
      imgUrls: Array.isArray(imgUrls) ? imgUrls : [imgUrls],
      initialIndex: initialIndex || 0,
    },
  );
}
