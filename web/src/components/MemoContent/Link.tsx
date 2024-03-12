import { Tooltip, Card, AspectRatio, Box } from "@mui/joy";
import { Link as MLink } from "@mui/joy";
import { useEffect, useState } from "react";
import { metadataServiceClient } from "@/grpcweb";

interface Props {
  url: string;
  text?: string;
}

const Link: React.FC<Props> = ({ text, url }: Props) => {
  const [title, setTitle] = useState<string>();
  const [description, setDescription] = useState<string>();
  const [image, setImage] = useState<string>();

  const fetchUrlMetadata = async () => {
    try {
      const response = await metadataServiceClient.getLinkMetadata({ url }, {});

      setTitle(response.metadata?.title);
      setDescription(response.metadata?.description);
      setImage(response.metadata?.image);
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
              {image ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex w-full">
                  <Card variant="outlined" orientation="vertical" sx={{ width: "100%" }}>
                    <AspectRatio ratio={"21/9"} objectFit="cover" variant="plain">
                      <img src={image} alt={title} className="pointer-events-none" />
                    </AspectRatio>
                    <div className="flex-1 overflow-auto w-full">
                      <div className="flex flex-col justify-between ">
                        <div>
                          <h3 className="text-2xl font-semibold tracking-tight truncate">{title}</h3>
                          {description && <p className="text-sm truncate">{description}</p>}
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
                        <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
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
