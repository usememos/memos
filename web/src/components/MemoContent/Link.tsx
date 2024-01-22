import { AspectRatio, Badge, Card, CardContent, Chip, Typography, useColorScheme } from "@mui/joy";
import MuiLink from "@mui/joy/Link";
import { ExternalLink, Twitter } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  url: string;
  text?: string;
}

const isYouTubeVideoUrl = (url: string) => {
  return url.includes("youtube.com") || url.includes("youtu.be");
};

const isYouTubeShortsUrl = (url: string) => {
  return url.includes("youtube.com/shorts");
};

const isTwitterUrl = (url: string) => {
  return url.includes("twitter.com");
};

const Link: React.FC<Props> = ({ text, url }: Props) => {
  //states for youtube video
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [creator, setCreator] = useState<string | undefined>(undefined);
  //const [provider, setProvider] = useState<string | undefined>(undefined);

  //states for youtube short
  const [shortsTitle, setShortsTitle] = useState<string | undefined>(undefined);
  const [shortsThumbnail, setShortsThumbnail] = useState<string | undefined>(undefined);
  const [shortsCreator, setShortsCreator] = useState<string | undefined>(undefined);

  //states for twitter
  const [tweetContent, setTweetContent] = useState<string | undefined>(undefined);
  const [tweetProfileName, setTweetProfileName] = useState<string | undefined>(undefined);
  const [tweetAuthorUsername, setTweetAuthorUsername] = useState<string | undefined>(undefined);
  const [tweetDate, setTweetDate] = useState<string | undefined>(undefined);

  function extractTweetText(html: string) {
    // Create a DOMParser to parse the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find the tweet text within the parsed HTML
    const tweetElement = doc.querySelector(".twitter-tweet");
    const tweetText = tweetElement ? tweetElement.textContent : "";

    return tweetText?.trim();
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isYouTubeShortsUrl(url)) {
          const shortsVideoId = url.split("shorts/").pop();
          const embedUrl = `https://www.youtube.com/embed/${shortsVideoId}`;
          const response = await fetch(`https://noembed.com/embed?dataType=json&url=${embedUrl}`);
          console.log(response);
          if (response) {
            const data = await response.json();
            setShortsTitle(data.title);
            setShortsThumbnail(data.thumbnail_url);
            setShortsCreator(data.author_name);
          }
        }
        if (isYouTubeVideoUrl(url)) {
          const response = await fetch(`https://noembed.com/embed?dataType=json&url=${url}`);
          if (response) {
            const data = await response.json();
            setTitle(data.title);
            setThumbnail(data.thumbnail_url);
            setCreator(data.author_name);
          }
        }
        if (isTwitterUrl(url)) {
          // Fetch Twitter data using noembed
          const response = await fetch(`https://noembed.com/embed?dataType=json&url=${url}`);
          if (response) {
            const twitterData = await response.json();
            const tweetText = extractTweetText(twitterData.html);
            setTweetProfileName(twitterData.author_name);
            setTweetAuthorUsername(twitterData.author_url.toString().split("/")[3]);
            setTweetContent(tweetText?.toString().split("pic")[0]);
            setTweetDate(tweetText?.toString().split(")")[1]);
          }
        }
      } catch (error) {
        console.error("Error fetching video info:", error);
      }
    };

    fetchData();
  }, [url]);

  // const { mode, systemMode } = useColorScheme();

  const renderLink = () => {
    if (isYouTubeShortsUrl(url)) {
      return (
        <>
          {/* For small screen */}
          <div className="flex lg:hidden">
            <Card
              variant="soft"
              orientation="vertical"
              sx={{
                width: "100%",
                // backgroundColor: "rgba(0, 0, 0, 0.25)",
                // "&:hover": {
                //   backgroundColor: "rgba(0, 0, 0, 0.5)",
                // },
              }}
            >
              <AspectRatio ratio={"16/9"} sx={{ width: "100%" }} objectFit={"cover"}>
                <img src={shortsThumbnail} alt={shortsTitle} />
              </AspectRatio>
              <CardContent sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography level="title-lg" id="card-description">
                  {shortsTitle && (
                    <div className="">
                      <h4 className=" text-lg font-semibold tracking-tight">{shortsTitle}</h4>
                    </div>
                  )}
                </Typography>
                <Typography level="body-sm" aria-describedby="card-description" mb={1}>
                  <div className="flex items-center justify-between mt-4">
                    <p className="">{shortsCreator}</p>
                    <Chip
                      variant="plain"
                      color="neutral"
                      sx={{
                        "--Chip-paddingInline": "40px",
                      }}
                    >
                      short
                    </Chip>
                  </div>
                </Typography>
                <MuiLink
                  overlay
                  underline={"none"}
                  href={url}
                  target="_black"
                  rel="noopener noreferrer"
                  className="absolute px-4 py-4 top-0 right-0"
                />
              </CardContent>
            </Card>
          </div>

          {/* For large screens */}
          <div className="hidden lg:flex mt-4 z-0 scale-95">
            <Badge sx={{ width: "100%" }} color="danger" variant="outlined">
              <Card
                variant="soft"
                orientation="horizontal"
                sx={{
                  width: "100%",
                  //backgroundColor: "rgba(0, 0, 0, 0.0)",
                  // border: "1px solid rgba(0, 0, 0, 0.0)",
                  // transition: "ease-in-out",
                  // transitionDuration: "0.25s",
                  // "&:hover": {
                  //   //backgroundColor: "rgba(0, 0, 0, 0.5)",
                  //   border: `1px solid ${mode === "dark" || systemMode === "dark" ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 1)"}`, // Adjust the colors based on your theme
                  // },
                }}
              >
                <AspectRatio ratio={"16/9"} sx={{ width: "25%" }} objectFit={"cover"}>
                  <img src={shortsThumbnail} alt={shortsTitle} className="" />
                </AspectRatio>
                <CardContent sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="title-lg" id="card-description">
                    {shortsTitle && (
                      <div className="">
                        <h4 className="scroll-m-20 text-lg font-semibold tracking-tight">{shortsTitle}</h4>
                      </div>
                    )}
                  </Typography>
                  <Typography level="body-sm" aria-describedby="card-description" mb={1}>
                    <p className="">{shortsCreator}</p>
                    {/* <div className="flex items-center justify-between mt-4">
                    <Chip
                      variant="plain"
                      color="neutral"
                      sx={{
                        "--Chip-paddingInline": "40px",
                      }}
                    >
                      short
                    </Chip>
                  </div> */}
                  </Typography>
                  <MuiLink
                    overlay
                    underline={"none"}
                    href={url}
                    target="_black"
                    rel="noopener noreferrer"
                    className="absolute px-4 py-4 top-0 right-0"
                  />
                </CardContent>
              </Card>
            </Badge>
          </div>
        </>
      );
    }
    if (isYouTubeVideoUrl(url)) {
      return (
        <>
          {/* For small screen */}
          <div className="flex lg:hidden">
            <Card
              variant="soft"
              orientation="vertical"
              sx={{
                width: "100%",
                // backgroundColor: `${mode === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.01)"}`,
                //border: "1px solid rgba(0, 0, 0, 1.0)",
              }}
            >
              <AspectRatio ratio={"16/9"} sx={{ width: "100%" }} objectFit={"cover"}>
                <img src={thumbnail} alt={title} />
              </AspectRatio>
              <CardContent sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography level="title-lg" id="card-description">
                  {title && (
                    <div className="">
                      <h4 className=" text-lg font-semibold tracking-tight">{title}</h4>
                    </div>
                  )}
                </Typography>
                <Typography level="body-sm" aria-describedby="card-description" mb={1}>
                  <div className="flex items-center justify-between mt-4">
                    <p className="">{creator}</p>
                    <Chip
                      variant="plain"
                      color="neutral"
                      sx={{
                        "--Chip-paddingInline": "40px",
                      }}
                    >
                      video
                    </Chip>
                  </div>
                </Typography>
                <MuiLink
                  overlay
                  underline={"none"}
                  href={url}
                  target="_black"
                  rel="noopener noreferrer"
                  className="absolute px-4 py-4 top-0 right-0"
                />
              </CardContent>
            </Card>
          </div>

          {/* For large screens */}
          <div className="hidden lg:flex mt-4 z-0 scale-95">
            <Badge sx={{ width: "100%" }} color="danger" variant="solid">
              <Card
                variant="soft"
                orientation="horizontal"
                sx={{
                  width: "100%",
                  // backgroundColor: `${mode === "dark" || systemMode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.05)"}`,
                  // //border: "1px solid rgba(0, 0, 0, 0.0)",
                  // transition: "ease-in-out",
                  // transitionDuration: "0.25s",
                  // "&:hover": {
                  //   backgroundColor: `${mode === "dark" || systemMode === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.1)"}`,
                  //   //border: `1px solid ${mode === "dark" || systemMode === "dark" ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 1)"}`, // Adjust the colors based on your theme
                  // },
                }}
              >
                <AspectRatio ratio={"16/9"} sx={{ width: "25%" }} objectFit={"cover"}>
                  <img src={thumbnail} alt={title} className="" />
                </AspectRatio>
                <CardContent sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="title-lg" id="card-description">
                    {title && (
                      <div className="">
                        <h4 className="scroll-m-20 text-lg font-semibold tracking-tight">{title}</h4>
                      </div>
                    )}
                  </Typography>
                  <Typography level="body-sm" aria-describedby="card-description" mt={1}>
                    <p className="">{creator}</p>
                  </Typography>
                  <MuiLink overlay underline={"none"} href={url} target="_black" rel="noopener noreferrer" />
                </CardContent>
              </Card>
            </Badge>
          </div>
        </>
      );
    }
    if (isTwitterUrl(url)) {
      return (
        <>
          {/* For small screen */}
          <div className="flex lg:hidden">
            <Card
              variant="soft"
              orientation="vertical"
              sx={{
                width: "100%",
                // backgroundColor: `${mode === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.01)"}`,
                //border: "1px solid rgba(0, 0, 0, 1.0)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-start">
                  <Typography level="title-lg" id="card-description">
                    <p>{tweetProfileName}</p>
                  </Typography>

                  <Typography level="title-sm" id="card-description">
                    <span>{"(@"}</span>
                    <span>{tweetAuthorUsername}</span>
                    <span>{")"}</span>
                  </Typography>
                </div>
                <Twitter />
              </div>
              <Typography level="body-sm" id="card-description">
                <p>{tweetContent}</p>
              </Typography>
              <Typography level="body-xs" id="card-description">
                <p className="italic">{tweetDate}</p>
              </Typography>
              <MuiLink overlay underline={"none"} href={url} target="_black" rel="noopener noreferrer" />
            </Card>
          </div>

          {/* For large screens */}
          <div className="hidden lg:flex mt-4 z-0 scale-95">
            <Card
              variant="soft"
              orientation="vertical"
              sx={{
                width: "100%",
                backgroundColor: "bg",
              }}
            >
              <div className="flex flex-row justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <Twitter className="text-blue-400" />
                  <Typography level="title-lg" id="card-description">
                    <p>{tweetProfileName}</p>
                  </Typography>

                  <Typography level="title-sm" id="card-description">
                    <span>{"(@"}</span>
                    <span>{tweetAuthorUsername}</span>
                    <span>{")"}</span>
                  </Typography>
                </div>
                <div className="flex justify-end">
                  <MuiLink underline={"none"} href={url} target="_black" rel="noopener noreferrer">
                    <ExternalLink className="text-gray-400" />
                  </MuiLink>
                </div>
              </div>
              <Typography level="body-" id="card-description">
                <p>{tweetContent}</p>
              </Typography>
              <Typography level="body-xs" id="card-description">
                <p className="italic">{tweetDate}</p>
              </Typography>
            </Card>
          </div>
        </>
      );
    }

    // If it's not a recognized video URL, just display a regular link
    return (
      <a
        className="text-blue-600 dark:text-blue-400 cursor-pointer underline break-all hover:opacity-80 decoration-1"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text || url}
      </a>
    );
  };

  return <div>{renderLink()}</div>;
};

export default Link;
