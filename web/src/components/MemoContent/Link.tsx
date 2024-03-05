import { AspectRatio, Card } from "@mui/joy";
import { useState, useEffect } from "react";

interface Props {
  url: string;
  text?: string;
}

const Link: React.FC<Props> = ({ text, url }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string>("");

  useEffect(() => {
    const fetchMetaTitle = async () => {
      try {
        const response = await fetch(`/o/get/meta?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          throw new Error("Failed to fetch meta title");
        }
        const data = await response.json();
        setTitle(data.title || "No Title.");
        setDescription(data.description || "No Description.");
        setImage(data.image);
      } catch (error) {
        console.error("Error fetching meta title:", error);
      }
    };

    fetchMetaTitle();
  }, [url]);

  return (
    <>
      {image ? (
        <>
          {/* Small Screens */}
          <div className="flex lg:hidden w-full">
            <a href={url} target="_blank" rel="noopener noreferrer" className="w-full">
              <Card variant="soft" orientation="vertical" sx={{ width: "100%" }} component={"span"}>
                {image && (
                  <AspectRatio ratio={"16/9"} objectFit="cover">
                    <img src={image} alt={title} />
                  </AspectRatio>
                )}

                <h3 className="text-2xl font-semibold tracking-tight truncate">{title || text}</h3>
                <p className="text-sm text-black/50 dark:text-white/50 truncate">{description || text}</p>
              </Card>
            </a>
          </div>

          {/* Medium to large screens */}
          <div className="hidden lg:flex w-full">
            <Card variant="soft" orientation="horizontal" sx={{ width: "100%" }} component={"span"}>
              {image && (
                <AspectRatio flex={true} ratio={"21/9"} objectFit="cover">
                  <img src={image} alt={title} className="" />
                </AspectRatio>
              )}
              <div className="flex-1 overflow-auto">
                <div className="flex flex-col justify-between h-full">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight truncate">{title || text}</h3>
                    <p className="text-sm text-black/50 dark:text-white/50 truncate">{description || text}</p>
                  </div>
                  <div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 ">
                      {url}
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card variant="soft" orientation="vertical" sx={{ width: "100%" }} component={"span"}>
          <h3 className="text-2xl font-semibold tracking-tight">{title || text}</h3>
          <p className="text-sm text-black/50 dark:text-white/50">{description || text}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 cursor-pointer break-all hover:opacity-80 decoration-1 w-fit"
          >
            {url}
          </a>
        </Card>
      )}
    </>
  );
};

export default Link;
