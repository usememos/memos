import classNames from "classnames";

interface Props {
  avatarUrl?: string;
  className?: string;
}

const UserAvatar = (props: Props) => {
  const { avatarUrl, className } = props;
  return (
    <div className={classNames(`w-8 h-8 overflow-clip`, className)}>
      <img className="w-full h-auto rounded-full min-w-full min-h-full object-cover" src={avatarUrl || "/logo.webp"} alt="" />
    </div>
  );
};

export default UserAvatar;
