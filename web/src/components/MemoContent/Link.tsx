import { Tooltip, Card, AspectRatio, Box } from "@mui/joy";
import { Link as MLink } from "@mui/joy";
import { useEffect, useState } from "react";
import { metadataServiceClient } from "@/grpcweb";
import { Metadata } from "@/types/proto/api/v2/link_service";

interface Props {
  url: string;
  text?: string;
}

const Link: React.FC<Props> = ({ text, url }: Props) => {
  const [linkMetadata, setLinkMetadata] = useState<Metadata | undefined>();

  const fetchUrlMetadata = async () => {
    try {
      const response = await metadataServiceClient.getLinkMetadata({ url }, {});
      setLinkMetadata(response.metadata);
    } catch (error) {
      console.error("Error fetching URL metadata:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchUrlMetadata();
  }, [url]);

  return (
    <>
      {/* Small screens */}
      <div className="flex md:hidden">
        <MLink href={url} underline="none" sx={{ fontWeight: "lg" }}>
          {url || text}
        </MLink>
      </div>

      {/* Medium & Above screens */}
      <div className="hidden md:flex">
        <Tooltip
          placement="top-end"
          variant="solid"
          sx={{}}
          title={
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                maxWidth: 450,
                maxHeight: 300,
              }}
            >
              {linkMetadata?.image ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex w-full">
                  <Card variant="outlined" orientation="vertical" sx={{ width: "100%" }}>
                    <AspectRatio ratio={"21/9"} objectFit="cover" variant="plain">
                      <img src={linkMetadata?.image} alt={linkMetadata?.title} className="pointer-events-none" />
                    </AspectRatio>
                    <div className="flex-1 overflow-auto w-full">
                      <div className="flex flex-col justify-between ">
                        <div>
                          <h3 className="text-2xl font-semibold tracking-tight truncate">{linkMetadata?.title}</h3>
                          {linkMetadata?.description && <p className="text-sm truncate">{linkMetadata?.description}</p>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </a>
              ) : (
                <Card variant="soft" orientation="vertical" sx={{ width: "100%" }}>
                  <div className="flex-1 overflow-auto w-full">
                    <div className="flex flex-col justify-between ">
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight">{linkMetadata?.title}</h3>
                        <p className="text-sm text-black/50 dark:text-white/50">No Preview</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </Box>
          }
        >
          <MLink href={url} underline="none" sx={{ fontWeight: "lg" }}>
            {url || text}
          </MLink>
        </Tooltip>
      </div>
    </>
  );
};

export default Link;
