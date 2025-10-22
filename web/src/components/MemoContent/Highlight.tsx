interface Props {
  content: string;
}

const Highlight: React.FC<Props> = ({ content }: Props) => {
  return <mark className="bg-accent text-accent-foreground px-1 rounded">{content}</mark>;
};

export default Highlight;
