import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentUrl } from "@/utils/attachment";
import ResourceIcon from "./ResourceIcon";

interface Props {
  resource: Attachment;
  className?: string;
}

const MemoResource: React.FC<Props> = (props: Props) => {
  const { className, resource } = props;
  const resourceUrl = getAttachmentUrl(resource);

  const handlePreviewBtnClick = () => {
    window.open(resourceUrl);
  };

  return (
    <div className={`w-auto flex flex-row justify-start items-center text-gray-500 dark:text-gray-400 hover:opacity-80 ${className}`}>
      {resource.type.startsWith("audio") ? (
        <audio src={resourceUrl} controls></audio>
      ) : (
        <>
          <ResourceIcon className="w-4! h-4! mr-1" resource={resource} />
          <span className="text-sm max-w-[256px] truncate cursor-pointer" onClick={handlePreviewBtnClick}>
            {resource.filename}
          </span>
        </>
      )}
    </div>
  );
};

export default MemoResource;
