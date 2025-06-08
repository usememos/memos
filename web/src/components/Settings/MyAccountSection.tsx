import { Button } from "@usememos/mui";
import { MoreVerticalIcon, PenLineIcon } from "lucide-react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";
import showChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import showUpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/Popover";
import AccessTokenSection from "./AccessTokenSection";

const MyAccountSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();

  return (
    <div className="w-full gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("setting.account-section.title")}</p>
      <div className="w-full mt-2 flex flex-row justify-start items-center">
        <UserAvatar className="mr-2 shrink-0 w-10 h-10" avatarUrl={user.avatarUrl} />
        <div className="max-w-[calc(100%-3rem)] flex flex-col justify-center items-start">
          <p className="w-full">
            <span className="text-xl leading-tight font-medium">{user.nickname}</span>
            <span className="ml-1 text-base leading-tight text-gray-500 dark:text-gray-400">({user.username})</span>
          </p>
          <p className="w-4/5 leading-tight text-sm truncate">{user.description}</p>
        </div>
      </div>
      <div className="w-full flex flex-row justify-start items-center mt-2 space-x-2">
        <Button variant="outlined" onClick={showUpdateAccountDialog}>
          <PenLineIcon className="w-4 h-4 mx-auto mr-1" />
          {t("common.edit")}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outlined">
              <MoreVerticalIcon className="w-4 h-4 mx-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="text-sm p-1">
            <button
              onClick={() => showChangeMemberPasswordDialog(user)}
              className="w-full flex items-center gap-2 px-2 py-1 text-left text-sm hover:bg-gray-100 rounded-md"
            >
              {t("setting.account-section.change-password")}
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <AccessTokenSection />
    </div>
  );
};

export default MyAccountSection;
