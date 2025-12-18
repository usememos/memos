import { timestampDate } from "@bufbuild/protobuf/wkt";
import { ClockIcon, MonitorIcon, SmartphoneIcon, TabletIcon, TrashIcon, WifiIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Session } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingTable from "./SettingTable";

const listSessions = async (parent: string) => {
  const { sessions } = await userServiceClient.listSessions({ parent });
  return sessions.sort(
    (a, b) =>
      ((b.lastAccessedTime ? timestampDate(b.lastAccessedTime) : undefined)?.getTime() ?? 0) -
      ((a.lastAccessedTime ? timestampDate(a.lastAccessedTime) : undefined)?.getTime() ?? 0),
  );
};

const UserSessionsSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [revokeTarget, setRevokeTarget] = useState<Session | undefined>(undefined);

  useEffect(() => {
    listSessions(currentUser.name).then((sessions) => {
      setSessions(sessions);
    });
  }, []);

  const handleRevokeSession = async (session: Session) => {
    setRevokeTarget(session);
  };

  const confirmRevokeSession = async () => {
    if (!revokeTarget) return;
    await userServiceClient.revokeSession({ name: revokeTarget.name });
    setSessions(sessions.filter((session) => session.sessionId !== revokeTarget.sessionId));
    toast.success(t("setting.user-sessions-section.session-revoked"));
    setRevokeTarget(undefined);
  };

  const getFormattedSessionId = (sessionId: string) => {
    return `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <SmartphoneIcon className="w-4 h-4 text-muted-foreground" />;
      case "tablet":
        return <TabletIcon className="w-4 h-4 text-muted-foreground" />;
      case "desktop":
      default:
        return <MonitorIcon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDeviceInfo = (clientInfo: Session["clientInfo"]) => {
    if (!clientInfo) return "Unknown Device";

    const parts = [];
    if (clientInfo.os) parts.push(clientInfo.os);
    if (clientInfo.browser) parts.push(clientInfo.browser);

    return parts.length > 0 ? parts.join(" • ") : "Unknown Device";
  };

  const isCurrentSession = (session: Session) => {
    // A simple heuristic: the most recently accessed session is likely the current one
    if (sessions.length === 0) return false;
    const mostRecent = sessions[0];
    return session.sessionId === mostRecent.sessionId;
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-medium text-muted-foreground">{t("setting.user-sessions-section.title")}</h4>
        <p className="text-xs text-muted-foreground">{t("setting.user-sessions-section.description")}</p>
      </div>

      <SettingTable
        columns={[
          {
            key: "device",
            header: t("setting.user-sessions-section.device"),
            render: (_, session: Session) => (
              <div className="flex items-center space-x-3">
                {getDeviceIcon(session.clientInfo?.deviceType || "")}
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {formatDeviceInfo(session.clientInfo)}
                    {isCurrentSession(session) && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                        <WifiIcon className="w-3 h-3 mr-1" />
                        {t("setting.user-sessions-section.current")}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{getFormattedSessionId(session.sessionId)}</span>
                </div>
              </div>
            ),
          },
          {
            key: "lastAccessedTime",
            header: t("setting.user-sessions-section.last-active"),
            render: (_, session: Session) => (
              <div className="flex items-center space-x-1">
                <ClockIcon className="w-4 h-4" />
                <span>{(session.lastAccessedTime ? timestampDate(session.lastAccessedTime) : undefined)?.toLocaleString()}</span>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, session: Session) => (
              <Button
                variant="ghost"
                size="sm"
                disabled={isCurrentSession(session)}
                onClick={() => handleRevokeSession(session)}
                title={
                  isCurrentSession(session)
                    ? t("setting.user-sessions-section.cannot-revoke-current")
                    : t("setting.user-sessions-section.revoke-session")
                }
              >
                <TrashIcon className={`w-4 h-auto ${isCurrentSession(session) ? "text-muted-foreground" : "text-destructive"}`} />
              </Button>
            ),
          },
        ]}
        data={sessions}
        emptyMessage={t("setting.user-sessions-section.no-sessions")}
        getRowKey={(session) => session.sessionId}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(undefined)}
        title={
          revokeTarget
            ? t("setting.user-sessions-section.session-revocation", {
                sessionId: getFormattedSessionId(revokeTarget.sessionId),
              })
            : ""
        }
        description={revokeTarget ? t("setting.user-sessions-section.session-revocation-description") : ""}
        confirmLabel={t("setting.user-sessions-section.revoke-session-button")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmRevokeSession}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default UserSessionsSection;
