import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { markdownServiceClient } from "@/grpcweb";
import { workspaceStore } from "@/store";
import { LinkMetadata, Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  url: string;
  content?: Node[];
}

const getFaviconWithGoogleS2 = (url: string) => {
  try {
    const urlObject = new URL(url);
    return `https://www.google.com/s2/favicons?sz=128&domain=${urlObject.hostname}`;
  } catch {
    return undefined;
  }
};

const Link: React.FC<Props> = ({ content, url }: Props) => {
  const workspaceMemoRelatedSetting = workspaceStore.state.memoRelatedSetting;
  const [initialized, setInitialized] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [linkMetadata, setLinkMetadata] = useState<LinkMetadata | undefined>();

  const handleMouseEnter = async () => {
    if (!workspaceMemoRelatedSetting.enableLinkPreview) {
      return;
    }

    setShowTooltip(true);
    if (!initialized) {
      try {
        const linkMetadata = await markdownServiceClient.getLinkMetadata({ link: url });
        setLinkMetadata(linkMetadata);
      } catch (error) {
        console.error("Error fetching URL metadata:", error);
      }
      setInitialized(true);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip open={showTooltip}>
        <TooltipTrigger asChild>
          <a
            className="underline text-primary hover:text-primary/80"
            target="_blank"
            href={url}
            rel="noopener noreferrer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {content ? content.map((child, index) => <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />) : url}
          </a>
        </TooltipTrigger>
        {linkMetadata && (
          <TooltipContent className="w-full max-w-64 sm:max-w-96 p-1">
            <div className="w-full flex flex-col">
              <div className="w-full flex flex-row justify-start items-center gap-1">
                <img className="w-5 h-5 rounded" src={getFaviconWithGoogleS2(url)} alt={linkMetadata?.title} />
                <h3 className="text-base truncate">{linkMetadata?.title}</h3>
              </div>
              {linkMetadata.description && (
                <p className="mt-1 w-full text-sm leading-snug opacity-80 line-clamp-3">{linkMetadata.description}</p>
              )}
              {linkMetadata.image && (
                <img className="mt-1 w-full h-32 object-cover rounded" src={linkMetadata.image} alt={linkMetadata.title} />
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

export default Link;
