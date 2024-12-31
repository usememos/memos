import { useCallback } from "react";
import { PhotoView } from "react-photo-view";

export interface ImageConfig {
  enablePhotoView?: boolean;
}

interface Props extends ImageConfig {
  altText: string;
  url: string;
}

const Image: React.FC<Props> = ({ altText, url, enablePhotoView = false }: Props) => {
  const renderImage = useCallback(() => {
    return (
      <img
        src={url}
        alt={altText}
        decoding="async"
        loading="lazy"
        className="max-h-[15rem] w-fit"
        onClick={(e) => {
          // Disable opening the default preview image dialog.
          if (enablePhotoView) {
            e.stopPropagation();
          }
        }}
      />
    );
  }, [altText, url, enablePhotoView]);

  return enablePhotoView ? <PhotoView src={url}>{renderImage()}</PhotoView> : renderImage();
};

export default Image;
