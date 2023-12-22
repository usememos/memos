interface Props {
  symbol: string;
  content: string;
}

const Italic: React.FC<Props> = ({ content }: Props) => {
  return <em>{content}</em>;
};

export default Italic;
