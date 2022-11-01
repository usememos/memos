import showPreviewImageCarouselDialog from "./PreviewImageCarouselDialog";
import "../less/image.less";

interface Props {
  imgUrls: string[];
  index: number;
  className?: string;
}

const Image: React.FC<Props> = (props: Props) => {
  const { className, imgUrls, index } = props;

  const handleImageClick = () => {
    showPreviewImageCarouselDialog(imgUrls, index);
  };

  return (
    <div className={"image-container " + className} onClick={handleImageClick}>
      <img src={imgUrls[index]} decoding="async" loading="lazy" />
    </div>
  );
};

export default Image;
