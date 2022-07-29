import * as utils from "../helpers/utils";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
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
          <Icon.X className="icon-img" />
        </button>
        <button className="btn" onClick={handleDownloadBtnClick}>
          <Icon.Download className="icon-img" />
        </button>
      </div>
      <div className="img-container">
        <img src={imgUrl} />
      </div>
    </>
  );
};

export default function showPreviewImageDialog(imgUrl: string): void {
  generateDialog(
    {
      className: "preview-image-dialog",
    },
    PreviewImageDialog,
    { imgUrl }
  );
}
