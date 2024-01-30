interface Props {
  message: string;
}

const Error = ({ message }: Props) => {
  return <p className="font-mono text-sm text-red-600 dark:text-red-700">{message}</p>;
};

export default Error;
