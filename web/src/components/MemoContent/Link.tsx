import { AspectRatio, Box, Card, Typography } from "@mui/joy";
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
        setTitle(data.title || "Empty");
        setDescription(data.description || "Empty");
        setImage(data.image);
      } catch (error) {
        console.error("Error fetching meta title:", error);
      }
    };

    fetchMetaTitle();
  }, [url]);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Card variant="outlined" size="sm" orientation="horizontal" sx={{ gap: 2, minWidth: 300 }}>
          <AspectRatio
            flex={true}
            objectFit="cover"
            ratio={"16/9"}
            sx={{
              flexBasis: 200,
              overflow: "auto",
            }}
          >
            {image && <img src={image} alt="Preview Image" className="w-full" />}
          </AspectRatio>
          <div>
            <Typography level="h4" component="h2">
              {title || text}
            </Typography>
            <Typography level="body-sm" component="p">
              {description || text}
            </Typography>
          </div>
        </Card>
      </Box>
    </a>
  );
};

export default Link;
