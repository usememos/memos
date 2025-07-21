interface Props {
  message: string;
}

const Error = ({ message }: Props) => {
  return <p className="font-mono text-sm text-destructive">{message}</p>;
};

export default Error;
