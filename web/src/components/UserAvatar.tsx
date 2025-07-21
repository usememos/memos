import { cn } from "@/lib/utils";

interface Props {
  avatarUrl?: string;
  className?: string;
}

const UserAvatar = (props: Props) => {
  const { avatarUrl, className } = props;
  return (
    <div className={cn(`w-8 h-8 overflow-clip rounded-xl border border-border`, className)}>
      <img
        className="w-full h-auto shadow min-w-full min-h-full object-cover"
        src={avatarUrl || "/full-logo.webp"}
        decoding="async"
        loading="lazy"
        alt=""
      />
    </div>
  );
};

export default UserAvatar;
