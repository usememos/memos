interface Props {
  text: string;
  url: string;
}

const Link: React.FC<Props> = ({ text, url }: Props) => {
  return (
    <a className="text-blue-600 dark:text-blue-400 cursor-pointer underline break-all hover:opacity-80 decoration-1" href={url}>
      {text}
    </a>
  );
};

export default Link;
