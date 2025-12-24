import { MoreVerticalIcon, PenLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { useTranslate } from "@/utils/i18n";
import ChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import UpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import AccessTokenSection from "./AccessTokenSection";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";

const MyAccountSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const accountDialog = useDialog();
  const passwordDialog = useDialog();

  const handleEditAccount = () => {
    accountDialog.open();
  };

  const handleChangePassword = () => {
    passwordDialog.open();
  };

  return (
    <SettingSection>
      <SettingGroup title={t("setting.account-section.title")}>
        <div className="w-full flex flex-row justify-start items-center gap-3">
          <UserAvatar className="shrink-0 w-12 h-12" avatarUrl={user?.avatarUrl} />
          <div className="flex-1 min-w-0 flex flex-col justify-center items-start gap-1">
            <div className="w-full">
              <span className="text-lg font-semibold">{user?.displayName}</span>
              <span className="ml-2 text-sm text-muted-foreground">@{user?.username}</span>
            </div>
            {user?.description && <p className="w-full text-sm text-muted-foreground truncate">{user?.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleEditAccount}>
              <PenLineIcon className="w-4 h-4 mr-1.5" />
              {t("common.edit")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVerticalIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleChangePassword}>{t("setting.account-section.change-password")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup showSeparator>
        <AccessTokenSection />
      </SettingGroup>

      {/* Update Account Dialog */}
      <UpdateAccountDialog open={accountDialog.isOpen} onOpenChange={accountDialog.setOpen} />

      {/* Change Password Dialog */}
      <ChangeMemberPasswordDialog open={passwordDialog.isOpen} onOpenChange={passwordDialog.setOpen} user={user} />
    </SettingSection>
  );
};

export default MyAccountSection;
