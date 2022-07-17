import { showDialog } from "./Dialog";
import * as utils from "../helpers/utils";
import "../less/preview-image-dialog.less";

interface Props extends DialogProps {
  imgUrl: string;
}

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrl }: Props) => {
  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadBtnClick = () => {
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
    a.click();
  };

  return (
    <>
      <div className="btns-container">
        <button className="btn" onClick={handleCloseBtnClick}>
          <i className="fa-solid fa-xmark fa-lg icon-img"></i>
        </button>
        <button className="btn" onClick={handleDownloadBtnClick}>
          <i className="fa-solid fa-download icon-img"></i>
        </button>
      </div>
      <div className="img-container">
        <img src={imgUrl} />
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
