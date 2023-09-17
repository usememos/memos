import { Resource } from "@/types/proto-grpcweb/api/v2/resource_service";
import { getResourceUrl } from "@/utils/resource";
import ResourceIcon from "./ResourceIcon";

interface Props {
  resource: Resource;
  className?: string;
}

const MemoResource: React.FC<Props> = (props: Props) => {
  const { className, resource } = props;
  const resourceUrl = getResourceUrl(resource);

  const handlePreviewBtnClick = () => {
    window.open(resourceUrl);
  };

  return (
    <>
      <div className={`w-auto flex flex-row justify-start items-center text-gray-500 dark:text-gray-400 hover:opacity-80 ${className}`}>
        {resource.type.startsWith("audio") ? (
          <>
            <audio controls>
              <source src={resourceUrl} type={resource.type} />
            </audio>
          </>
        ) : (
          <>
            <ResourceIcon className="!w-4 !h-4 mr-1" resource={resource} />
            <span className="text-sm max-w-[256px] truncate cursor-pointer" onClick={handlePreviewBtnClick}>
              {resource.filename}
            </span>
          </>
        )}
      </div>
    </>
  );
};

export default MemoResource;
