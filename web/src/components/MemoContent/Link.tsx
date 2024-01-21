interface Props {
  url: string;
  text?: string;
}

const isYouTubeUrl = (url: string) => {
  // Add more conditions as needed for other video platforms
  return url.includes("youtube.com");
};

const Link: React.FC<Props> = ({ text, url }: Props) => {
  const renderVideo = () => {
    if (isYouTubeUrl(url)) {
      // If it's a YouTube URL, display an embedded YouTube video
      const youtubeId = url.match(
        /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      )?.[1];

      if (youtubeId) {
        return (
          <div className="flex items-center">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube video player"
              allowFullScreen
              className="object-contain"
            ></iframe>
          </div>
        );
      }
    }

    // Add more conditions for other video platforms

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

  return <div>{renderVideo()}</div>;
};

export default Link;
