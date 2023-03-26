interface Props {
  avatarUrl?: string;
  className?: string;
}

const UserAvatar = (props: Props) => {
  const { avatarUrl, className } = props;
  return (
    <div className={`${className ?? ""} w-8 h-8 rounded-full overflow-clip bg-gray-100 dark:bg-zinc-800`}>
      <img className="w-full h-auto min-w-full min-h-full object-cover" src={avatarUrl || "/logo.png"} alt="" />
    </div>
  );
};

export default UserAvatar;
