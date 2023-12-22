interface Props {
  content: string;
}

const Text: React.FC<Props> = ({ content }: Props) => {
  return <span>{content}</span>;
};

export default Text;
