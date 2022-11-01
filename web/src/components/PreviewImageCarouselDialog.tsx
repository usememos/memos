import * as utils from "../helpers/utils";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import "../less/preview-image-carousel-dialog.less";

interface Props extends DialogProps {
  imgUrls: string[];
  index: number;
}

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrls, index }: Props) => {
  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadBtnClick = () => {
    const a = document.createElement("a");
    a.href = imgUrls[index];
    a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
    a.click();
  };

  const handleImgContainerClick = () => {
    destroy();
  };

  const handlePrevBtnClick = () => {
    destroy();
    if (index > 0) {
      showPreviewImageCarouselDialog(imgUrls, index - 1);
    } else {
      showPreviewImageCarouselDialog(imgUrls, imgUrls.length - 1);
    }
  };

  const handleNextBtnClick = () => {
    destroy();
    if (index < imgUrls.length - 1) {
      showPreviewImageCarouselDialog(imgUrls, index + 1);
    } else {
      showPreviewImageCarouselDialog(imgUrls, 0);
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
        <button className="btn" onClick={handlePrevBtnClick}>
          <Icon.ArrowLeft className="icon-img" />
        </button>
        <button className="btn" onClick={handleNextBtnClick}>
          <Icon.ArrowRight className="icon-img" />
        </button>
      </div>
      <div className="img-container" onClick={handleImgContainerClick}>
        <img onClick={(e) => e.stopPropagation()} src={imgUrls[index]} />
      </div>
    </>
  );
};

export default function showPreviewImageCarouselDialog(imgUrls: string[], index: number): void {
  generateDialog(
    {
      className: "preview-image-carousel-dialog",
    },
    PreviewImageDialog,
    { imgUrls, index }
  );
}
