import { showDialog } from "./Dialog";
import "../less/preview-image-dialog.less";

interface Props extends DialogProps {
  imgUrl: string;
}

const PreviewImageDialog: React.FC<Props> = ({ destroy, imgUrl }: Props) => {
  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <button className="btn close-btn" onClick={handleCloseBtnClick}>
        <img className="icon-img" src="/icons/close.svg" />
      </button>

      <div className="img-container">
        <img src={imgUrl} crossOrigin="anonymous" />
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
