interface OnlyWhenProps {
  children: React.ReactElement;
  when: boolean;
}

const OnlyWhen: React.FC<OnlyWhenProps> = (props: OnlyWhenProps) => {
  const { children, when } = props;
  return when ? <>{children}</> : null;
};

const Only = OnlyWhen;

export default Only;
