interface Props {
  symbol: string;
  content: string;
}

const BoldItalic: React.FC<Props> = ({ content }: Props) => {
  return (
    <strong>
      <em>{content}</em>
    </strong>
  );
};

export default BoldItalic;
