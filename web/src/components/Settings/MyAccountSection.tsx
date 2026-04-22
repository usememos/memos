import { MoreVerticalIcon, PenLineIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import useNavigateTo from "@/hooks/useNavigateTo";
import { handleError } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import ChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import UpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import AccessTokenSection from "./AccessTokenSection";
import LinkedIdentitySection from "./LinkedIdentitySection";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";

const MyAccountSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigateTo = useNavigateTo();
  const accountDialog = useDialog();
  const passwordDialog = useDialog();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user?.name) {
      return;
    }
    try {
      await userServiceClient.deleteUser({ name: user.name });
      await logout();
      toast.success(t("setting.member.delete-success", { username: user.username }));
      navigateTo(ROUTES.AUTH, { replace: true });
    } catch (error) {
      handleError(error, toast.error, { context: "Delete account" });
      throw error;
    }
  };

  return (
    <SettingSection title={t("setting.my-account.label")}>
      <SettingGroup title={t("setting.account.title")}>
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
            <Button variant="outline" size="sm" onClick={accountDialog.open}>
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
                <DropdownMenuItem onClick={passwordDialog.open}>{t("setting.account.change-password")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  {t("setting.account.delete-account")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SettingGroup>

      <LinkedIdentitySection />

      <AccessTokenSection />

      {/* Update Account Dialog */}
      <UpdateAccountDialog open={accountDialog.isOpen} onOpenChange={accountDialog.setOpen} />

      {/* Change Password Dialog */}
      <ChangeMemberPasswordDialog open={passwordDialog.isOpen} onOpenChange={passwordDialog.setOpen} user={user} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={user ? t("setting.member.delete-warning", { username: user.username }) : ""}
        description={t("setting.member.delete-warning-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteAccount}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default MyAccountSection;
