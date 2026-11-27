import { Button } from "@usememos/ui";
import { KeyRoundIcon, PenLineIcon } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import useNavigateTo from "@/hooks/useNavigateTo";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import ChangeMemberPasswordDialog from "../ChangeMemberPasswordDialog";
import UpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import LinkedIdentitySection from "./LinkedIdentitySection";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";
import UsageSection from "./UsageSection";
import UserStatsSection from "./UserStatsSection";

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
      toast.add({ title: t("setting.member.delete-success", { username: user.username }), type: "success" });
      navigateTo(ROUTES.AUTH, { replace: true });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Delete account" });
      throw error;
    }
  };

  return (
    <SettingSection title={t("setting.my-account.label")}>
      <SettingGroup title={t("setting.account.title")}>
        <div className="w-full flex flex-row flex-wrap justify-start items-center gap-3">
          <UserAvatar className="shrink-0 w-12 h-12" avatarUrl={user?.avatarUrl} name={user?.displayName || user?.username} />
          <div className="flex-1 min-w-40 flex flex-col justify-center items-start gap-1">
            <div className="w-full">
              <span className="mu-label">{user?.displayName}</span>
              <span className="ml-2 mu-body text-mu-text-secondary">@{user?.username}</span>
            </div>
            {user?.description && <p className="w-full mu-body text-mu-text-secondary truncate">{user?.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="neutral" onClick={accountDialog.open} icon={<PenLineIcon />}>
              {t("common.edit")}
            </Button>
            <Button variant="neutral" onClick={passwordDialog.open} icon={<KeyRoundIcon />}>
              {t("setting.account.change-password")}
            </Button>
          </div>
        </div>
      </SettingGroup>

      <UserStatsSection />

      <UsageSection />

      <LinkedIdentitySection />

      <SettingGroup showSeparator title={t("setting.account.danger-area")} description={t("setting.account.danger-area-description")}>
        {/* A plain row: red is kept for the confirm step, not the section that leads to it. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="mu-label text-mu-text">{t("setting.account.delete-account")}</p>
            <p className="mu-caption text-mu-text-secondary">{t("setting.account.delete-account-description")}</p>
          </div>
          <Button variant="neutral" className="shrink-0 self-start sm:self-auto" onClick={() => setDeleteOpen(true)}>
            {t("setting.account.delete-account")}
          </Button>
        </div>
      </SettingGroup>

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
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

export default MyAccountSection;
