import { getResourceUrl } from "../utils/resource";
import Icon from "./Icon";

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
      <div className={`w-auto flex flex-row justify-start items-center hover:opacity-80 ${className}`}>
        {resource.type.startsWith("audio") ? (
          <>
            <audio className="h-8" src={resourceUrl} controls></audio>
          </>
        ) : (
          <>
            <Icon.FileText className="w-4 h-auto mr-1 text-gray-500" />
            <span className="text-gray-500 text-sm max-w-[256px] truncate font-mono cursor-pointer" onClick={handlePreviewBtnClick}>
              {resource.filename}
            </span>
          </>
        )}
      </div>
    </>
  );
};

export default MemoResource;
