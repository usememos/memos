interface Props {
  content: string;
}

const Highlight: React.FC<Props> = ({ content }: Props) => {
  return <mark className="bg-yellow-200 text-foreground px-1 rounded">{content}</mark>;
};

export default Highlight;
