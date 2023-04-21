interface Props {
  className?: string;
}

const Divider = ({ className }: Props) => {
  return <hr className={`${className} block my-1 border-gray-200 dark:border-gray-600`} />;
};

export default Divider;
