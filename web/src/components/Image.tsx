import showPreviewImageDialog from "./PreviewImageDialog";
import "../less/image.less";

interface Props {
  imgUrl: string;
  className?: string;
}

const Image: React.FC<Props> = (props: Props) => {
  const { className, imgUrl } = props;

  const handleImageClick = () => {
    showPreviewImageDialog(imgUrl);
  };

  return (
    <div className={"image-container " + className} onClick={handleImageClick}>
      <img src={imgUrl} decoding="async" loading="lazy" />
    </div>
  );
};

export default Image;
