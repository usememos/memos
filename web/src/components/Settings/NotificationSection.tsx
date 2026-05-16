import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { instanceServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { handleError } from "@/lib/error";
import {
  InstanceSetting_Key,
  InstanceSetting_NotificationSetting,
  InstanceSetting_NotificationSetting_EmailSetting,
  InstanceSetting_NotificationSetting_EmailSettingSchema,
  InstanceSetting_NotificationSettingSchema,
  InstanceSettingSchema,
  TestInstanceEmailSettingRequestSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const defaultEmailSetting = () =>
  create(InstanceSetting_NotificationSetting_EmailSettingSchema, {
    smtpPort: 587,
    useTls: true,
  });

const isEmailSettingConfigured = (email?: InstanceSetting_NotificationSetting_EmailSetting) => {
  return Boolean(
    email &&
      (email.enabled ||
        email.smtpHost.trim() ||
        email.smtpPort > 0 ||
        email.smtpUsername.trim() ||
        email.fromEmail.trim() ||
        email.fromName.trim() ||
        email.replyTo.trim() ||
        email.useTls ||
        email.useSsl),
  );
};

const normalizeNotificationSetting = (setting: InstanceSetting_NotificationSetting) =>
  create(InstanceSetting_NotificationSettingSchema, {
    ...setting,
    email: isEmailSettingConfigured(setting.email) ? setting.email : defaultEmailSetting(),
  });

type Requirement = "required" | "optional" | "gmail" | "recommended";

const FieldLabel = ({ label, requirementLabel, requirement }: { label: string; requirementLabel: string; requirement: Requirement }) => (
  <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
    <span>{label}</span>
    <Badge
      variant={requirement === "optional" ? "outline" : "secondary"}
      className="rounded-md px-1.5 py-0 text-[10px] font-normal leading-4 text-muted-foreground"
    >
      {requirementLabel}
    </Badge>
  </span>
);

const NotificationSection = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const currentUser = useCurrentUser();
  const { notificationSetting: originalSetting } = useInstance();
  const normalizedOriginalSetting = useMemo(() => normalizeNotificationSetting(originalSetting), [originalSetting]);
  const [notificationSetting, setNotificationSetting] = useState<InstanceSetting_NotificationSetting>(normalizedOriginalSetting);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  useEffect(() => {
    setNotificationSetting(normalizedOriginalSetting);
  }, [normalizedOriginalSetting]);

  const emailSetting = notificationSetting.email ?? defaultEmailSetting();
  const hasExistingEmailSetting = isEmailSettingConfigured(originalSetting.email);
  const requirementLabel = (requirement: Requirement) => t(`setting.notification.requirement-${requirement}`);
  const fieldLabel = (label: string, requirement: Requirement) => (
    <FieldLabel label={label} requirement={requirement} requirementLabel={requirementLabel(requirement)} />
  );

  const updateEmailSetting = (partial: Partial<InstanceSetting_NotificationSetting_EmailSetting>) => {
    const nextEmail = create(InstanceSetting_NotificationSetting_EmailSettingSchema, {
      ...emailSetting,
      ...partial,
    });

    setNotificationSetting(
      create(InstanceSetting_NotificationSettingSchema, {
        ...notificationSetting,
        email: nextEmail,
      }),
    );
  };

  const handlePortChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const port = parseInt(event.target.value);
    updateEmailSetting({ smtpPort: Number.isNaN(port) ? 0 : port });
  };

  const handleUseTLSChanged = (checked: boolean) => {
    updateEmailSetting({ useTls: checked, useSsl: checked ? false : emailSetting.useSsl });
  };

  const handleUseSSLChanged = (checked: boolean) => {
    updateEmailSetting({ useSsl: checked, useTls: checked ? false : emailSetting.useTls });
  };

  const allowSave = useMemo(() => {
    if (isEqual(normalizedOriginalSetting, notificationSetting)) {
      return false;
    }
    const email = notificationSetting.email;
    if (!email?.enabled) {
      return true;
    }
    return Boolean(email.smtpHost.trim() && email.smtpPort > 0 && email.smtpPort <= 65535 && email.fromEmail.trim());
  }, [notificationSetting, normalizedOriginalSetting]);

  const canTestEmail = useMemo(() => {
    return Boolean(
      currentUser?.email &&
        emailSetting.smtpHost.trim() &&
        emailSetting.smtpPort > 0 &&
        emailSetting.smtpPort <= 65535 &&
        emailSetting.fromEmail.trim(),
    );
  }, [currentUser?.email, emailSetting.fromEmail, emailSetting.smtpHost, emailSetting.smtpPort]);

  const saveNotificationSetting = async () => {
    await saveInstanceSetting({
      key: InstanceSetting_Key.NOTIFICATION,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.NOTIFICATION),
        value: {
          case: "notificationSetting",
          value: notificationSetting,
        },
      }),
      errorContext: "Update notification settings",
    });
  };

  const testEmailSetting = async () => {
    if (!currentUser?.email) {
      toast.error(t("setting.notification.test-email-missing-recipient"));
      return;
    }

    setIsTestingEmail(true);
    try {
      await instanceServiceClient.testInstanceEmailSetting(
        create(TestInstanceEmailSettingRequestSchema, {
          email: emailSetting,
          recipientEmail: currentUser.email,
        }),
      );
      toast.success(t("setting.notification.test-email-success", { email: currentUser.email }));
    } catch (error: unknown) {
      await handleError(error, toast.error, { context: "Send test email" });
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <SettingSection title={t("setting.notification.label")}>
      <SettingGroup title={t("setting.notification.email-title")} description={t("setting.notification.email-description")}>
        <SettingRow label={t("setting.notification.email-enabled")} description={t("setting.notification.email-enabled-description")}>
          <Switch checked={emailSetting.enabled} onCheckedChange={(enabled) => updateEmailSetting({ enabled })} />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.smtp-host"), "required")}
          description={t("setting.notification.smtp-host-description")}
        >
          <Input
            className="w-full sm:w-80"
            value={emailSetting.smtpHost}
            placeholder="smtp.gmail.com"
            aria-required={emailSetting.enabled}
            onChange={(e) => updateEmailSetting({ smtpHost: e.target.value })}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.smtp-port"), "required")}
          description={t("setting.notification.smtp-port-description")}
        >
          <Input
            className="w-28 font-mono"
            type="number"
            min={1}
            max={65535}
            value={emailSetting.smtpPort}
            placeholder="587"
            aria-required={emailSetting.enabled}
            onChange={handlePortChanged}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.smtp-username"), "gmail")}
          description={t("setting.notification.smtp-username-description")}
        >
          <Input
            className="w-full sm:w-80"
            type="email"
            value={emailSetting.smtpUsername}
            placeholder="your.name@gmail.com"
            autoComplete="username"
            onChange={(e) => updateEmailSetting({ smtpUsername: e.target.value })}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.smtp-password"), "gmail")}
          description={
            hasExistingEmailSetting
              ? t("setting.notification.smtp-password-preserve-description")
              : t("setting.notification.smtp-password-description")
          }
        >
          <Input
            className="w-full sm:w-80"
            type="password"
            value={emailSetting.smtpPassword}
            placeholder={hasExistingEmailSetting ? t("setting.notification.smtp-password-placeholder-existing") : "abcd efgh ijkl mnop"}
            autoComplete="new-password"
            onChange={(e) => updateEmailSetting({ smtpPassword: e.target.value })}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.from-email"), "required")}
          description={t("setting.notification.from-email-description")}
        >
          <Input
            className="w-full sm:w-80"
            type="email"
            value={emailSetting.fromEmail}
            placeholder="your.name@gmail.com"
            aria-required={emailSetting.enabled}
            onChange={(e) => updateEmailSetting({ fromEmail: e.target.value })}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.from-name"), "optional")}
          description={t("setting.notification.from-name-description")}
        >
          <Input
            className="w-full sm:w-80"
            value={emailSetting.fromName}
            placeholder="Memos"
            onChange={(e) => updateEmailSetting({ fromName: e.target.value })}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.reply-to"), "optional")}
          description={t("setting.notification.reply-to-description")}
        >
          <Input
            className="w-full sm:w-80"
            type="email"
            value={emailSetting.replyTo}
            placeholder="support@example.com"
            onChange={(e) => updateEmailSetting({ replyTo: e.target.value })}
          />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.use-tls"), "recommended")}
          description={t("setting.notification.use-tls-description")}
        >
          <Switch checked={emailSetting.useTls} onCheckedChange={handleUseTLSChanged} />
        </SettingRow>

        <SettingRow
          label={fieldLabel(t("setting.notification.use-ssl"), "optional")}
          description={t("setting.notification.use-ssl-description")}
        >
          <Switch checked={emailSetting.useSsl} onCheckedChange={handleUseSSLChanged} />
        </SettingRow>
      </SettingGroup>

      <div className="w-full flex flex-col justify-end gap-2 sm:flex-row">
        <Button variant="outline" disabled={!canTestEmail || isTestingEmail} onClick={testEmailSetting}>
          {isTestingEmail ? t("setting.notification.test-email-sending") : t("setting.notification.test-email")}
        </Button>
        <Button disabled={!allowSave} onClick={saveNotificationSetting}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default NotificationSection;
