import { Link } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import UserAvatar from "@/components/UserAvatar";

const DesktopHeader = () => {
  const { generalSetting } = useInstance();
  const title = generalSetting.customProfile?.title || "Memos";
  const avatarUrl = generalSetting.customProfile?.logoUrl || "/full-logo.webp";

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="w-full flex flex-row justify-between items-center">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <UserAvatar className="shrink-0 w-6 h-6 rounded-md" avatarUrl={avatarUrl} />
          <span className="font-bold text-lg leading-6 text-foreground truncate">{title}</span>
        </Link>
        <div className="flex flex-row justify-end items-center">
          <div id="memo-selection-actions" className="flex flex-row justify-end items-center" />
        </div>
      </div>
    </div>
  );
};

export default DesktopHeader;
