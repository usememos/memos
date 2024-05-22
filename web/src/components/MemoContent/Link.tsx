import { Link as MLink, Tooltip } from "@mui/joy";
import { useState } from "react";
import { markdownServiceClient } from "@/grpcweb";
import { LinkMetadata } from "@/types/proto/api/v1/markdown_service";

interface Props {
  url: string;
  text?: string;
}

const getFaviconWithGoogleS2 = (url: string) => {
  try {
    const urlObject = new URL(url);
    return `https://www.google.com/s2/favicons?sz=128&domain=${urlObject.hostname}`;
  } catch (error) {
    return undefined;
  }
};

const Link: React.FC<Props> = ({ text, url }: Props) => {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [linkMetadata, setLinkMetadata] = useState<LinkMetadata | undefined>();

  const handleMouseEnter = async () => {
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
    <Tooltip
      variant="outlined"
      title={
        linkMetadata && (
          <div className="w-full max-w-64 sm:max-w-96 p-1 flex flex-col">
            <div className="w-full flex flex-row justify-start items-center gap-1">
              <img className="w-5 h-5 rounded" src={getFaviconWithGoogleS2(url)} alt={linkMetadata?.title} />
              <h3 className="text-base truncate dark:opacity-90">{linkMetadata?.title}</h3>
            </div>
            {linkMetadata.description && (
              <p className="mt-1 w-full text-sm leading-snug opacity-80 line-clamp-3">{linkMetadata.description}</p>
            )}
          </div>
        )
      }
      open={showTooltip}
      arrow
    >
      <MLink underline="always" target="_blank" href={url}>
        <span onMouseEnter={handleMouseEnter} onMouseLeave={() => setShowTooltip(false)}>
          {text || url}
        </span>
      </MLink>
    </Tooltip>
  );
};

export default Link;
