interface Props {
  content: string;
}

const Subscript: React.FC<Props> = ({ content }: Props) => {
  return <sub>{content}</sub>;
};

export default Subscript;
