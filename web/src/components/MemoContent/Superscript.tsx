interface Props {
  content: string;
}

const Superscript: React.FC<Props> = ({ content }: Props) => {
  return <sup>{content}</sup>;
};

export default Superscript;
