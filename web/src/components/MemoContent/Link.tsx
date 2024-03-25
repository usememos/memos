import { Link as MLink, Tooltip } from "@mui/joy";
import { useEffect, useState } from "react";
import { linkServiceClient } from "@/grpcweb";
import { LinkMetadata } from "@/types/proto/api/v2/link_service";

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
  const [linkMetadata, setLinkMetadata] = useState<LinkMetadata | undefined>();

  useEffect(() => {
    (async () => {
      try {
        const { linkMetadata } = await linkServiceClient.getLinkMetadata({ link: url }, {});
        setLinkMetadata(linkMetadata);
      } catch (error) {
        console.error("Error fetching URL metadata:", error);
      }
    })();
  }, [url]);

  return linkMetadata ? (
    <Tooltip
      variant="outlined"
      title={
        <div className="w-full max-w-64 sm:max-w-96 p-1 flex flex-col">
          <a href={url} target="_blank" rel="noopener noreferrer" className="group w-full flex flex-row justify-start items-center gap-1">
            <img className="w-5 h-5 pointer-events-none" src={getFaviconWithGoogleS2(url)} alt={linkMetadata?.title} />
            <h3 className="text-base truncate dark:opacity-90 group-hover:opacity-80 group-hover:underline">{linkMetadata?.title}</h3>
          </a>
          {linkMetadata.description && (
            <p className="mt-1 w-full text-sm leading-snug opacity-80 line-clamp-3">{linkMetadata.description}</p>
          )}
        </div>
      }
      arrow
    >
      <MLink underline="always" href={url}>
        {text || url}
      </MLink>
    </Tooltip>
  ) : (
    <MLink underline="always" href={url}>
      {text || url}
    </MLink>
  );
};

export default Link;
