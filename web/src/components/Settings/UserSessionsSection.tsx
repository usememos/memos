import { ClockIcon, MonitorIcon, SmartphoneIcon, TabletIcon, TrashIcon, WifiIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserSession } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

const listUserSessions = async (parent: string) => {
  const { sessions } = await userServiceClient.listUserSessions({ parent });
  return sessions.sort((a, b) => (b.lastAccessedTime?.getTime() ?? 0) - (a.lastAccessedTime?.getTime() ?? 0));
};

const UserSessionsSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [revokeTarget, setRevokeTarget] = useState<UserSession | undefined>(undefined);

  useEffect(() => {
    listUserSessions(currentUser.name).then((sessions) => {
      setUserSessions(sessions);
    });
  }, []);

  const handleRevokeSession = async (userSession: UserSession) => {
    setRevokeTarget(userSession);
  };

  const confirmRevokeSession = async () => {
    if (!revokeTarget) return;
    await userServiceClient.revokeUserSession({ name: revokeTarget.name });
    setUserSessions(userSessions.filter((session) => session.sessionId !== revokeTarget.sessionId));
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

  const formatDeviceInfo = (clientInfo: UserSession["clientInfo"]) => {
    if (!clientInfo) return "Unknown Device";

    const parts = [];
    if (clientInfo.os) parts.push(clientInfo.os);
    if (clientInfo.browser) parts.push(clientInfo.browser);

    return parts.length > 0 ? parts.join(" • ") : "Unknown Device";
  };

  const isCurrentSession = (session: UserSession) => {
    // A simple heuristic: the most recently accessed session is likely the current one
    if (userSessions.length === 0) return false;
    const mostRecent = userSessions[0];
    return session.sessionId === mostRecent.sessionId;
  };

  return (
    <div className="mt-6 w-full flex flex-col justify-start items-start space-y-4">
      <div className="w-full">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex-auto space-y-1">
            <p className="flex flex-row justify-start items-center font-medium text-muted-foreground">
              {t("setting.user-sessions-section.title")}
            </p>
            <p className="text-sm text-muted-foreground">{t("setting.user-sessions-section.description")}</p>
          </div>
        </div>
        <div className="w-full mt-2 flow-root">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full border border-border rounded-lg align-middle">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">
                      {t("setting.user-sessions-section.device")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">
                      {t("setting.user-sessions-section.last-active")}
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4">
                      <span className="sr-only">{t("common.delete")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userSessions.map((userSession) => (
                    <tr key={userSession.sessionId}>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground">
                        <div className="flex items-center space-x-3">
                          {getDeviceIcon(userSession.clientInfo?.deviceType || "")}
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatDeviceInfo(userSession.clientInfo)}
                              {isCurrentSession(userSession) && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                                  <WifiIcon className="w-3 h-3 mr-1" />
                                  {t("setting.user-sessions-section.current")}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{getFormattedSessionId(userSession.sessionId)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>{userSession.lastAccessedTime?.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm">
                        <Button
                          variant="ghost"
                          disabled={isCurrentSession(userSession)}
                          onClick={() => {
                            handleRevokeSession(userSession);
                          }}
                          title={
                            isCurrentSession(userSession)
                              ? t("setting.user-sessions-section.cannot-revoke-current")
                              : t("setting.user-sessions-section.revoke-session")
                          }
                        >
                          <TrashIcon
                            className={`w-4 h-auto ${isCurrentSession(userSession) ? "text-muted-foreground" : "text-destructive"}`}
                          />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {userSessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">{t("setting.user-sessions-section.no-sessions")}</div>
              )}
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default UserSessionsSection;
