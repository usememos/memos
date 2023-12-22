interface Props {
  content: string;
}

const Strikethrough: React.FC<Props> = ({ content }: Props) => {
  return <del>{content}</del>;
};

export default Strikethrough;
