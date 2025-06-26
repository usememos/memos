import { Button } from "@usememos/mui";
import { ClockIcon, MonitorIcon, SmartphoneIcon, TabletIcon, TrashIcon, WifiIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserSession } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import LearnMore from "../LearnMore";

const listUserSessions = async (parent: string) => {
  const { sessions } = await userServiceClient.listUserSessions({ parent });
  return sessions.sort((a, b) => (b.lastAccessedTime?.getTime() ?? 0) - (a.lastAccessedTime?.getTime() ?? 0));
};

const UserSessionsSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);

  useEffect(() => {
    listUserSessions(currentUser.name).then((sessions) => {
      setUserSessions(sessions);
    });
  }, []);

  const handleRevokeSession = async (userSession: UserSession) => {
    const formattedSessionId = getFormattedSessionId(userSession.sessionId);
    const confirmed = window.confirm(t("setting.user-sessions-section.session-revocation", { sessionId: formattedSessionId }));
    if (confirmed) {
      await userServiceClient.revokeUserSession({ name: userSession.name });
      setUserSessions(userSessions.filter((session) => session.sessionId !== userSession.sessionId));
      toast.success(t("setting.user-sessions-section.session-revoked"));
    }
  };

  const getFormattedSessionId = (sessionId: string) => {
    return `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <SmartphoneIcon className="w-4 h-4 text-gray-500" />;
      case "tablet":
        return <TabletIcon className="w-4 h-4 text-gray-500" />;
      case "desktop":
      default:
        return <MonitorIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDeviceInfo = (clientInfo: UserSession["clientInfo"]) => {
    if (!clientInfo) return "Unknown Device";

    const parts = [];
    if (clientInfo.os) parts.push(clientInfo.os);
    if (clientInfo.browser) parts.push(clientInfo.browser);

    return parts.length > 0 ? parts.join(" • ") : "Unknown Device";
  };

  const getSessionExpirationDate = (session: UserSession) => {
    if (!session.lastAccessedTime) return null;
    // Calculate expiration as last_accessed_time + 2 weeks (14 days)
    const expirationDate = new Date(session.lastAccessedTime.getTime() + 14 * 24 * 60 * 60 * 1000);
    return expirationDate;
  };

  const isSessionExpired = (session: UserSession) => {
    const expirationDate = getSessionExpirationDate(session);
    return expirationDate ? expirationDate < new Date() : false;
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
            <p className="flex flex-row justify-start items-center font-medium text-gray-700 dark:text-gray-400">
              {t("setting.user-sessions-section.title")}
              <LearnMore className="ml-2" url="https://usememos.com/docs/security/sessions" />
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-500">{t("setting.user-sessions-section.description")}</p>
          </div>
        </div>
        <div className="w-full mt-2 flow-root">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full border border-zinc-200 rounded-lg align-middle dark:border-zinc-600">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-600">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      {t("setting.user-sessions-section.device")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      {t("setting.user-sessions-section.last-active")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      {t("setting.user-sessions-section.expires")}
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4">
                      <span className="sr-only">{t("common.delete")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {userSessions.map((userSession) => (
                    <tr key={userSession.sessionId}>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-gray-400">
                        <div className="flex items-center space-x-3">
                          {getDeviceIcon(userSession.clientInfo?.deviceType || "")}
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatDeviceInfo(userSession.clientInfo)}
                              {isCurrentSession(userSession) && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                  <WifiIcon className="w-3 h-3 mr-1" />
                                  {t("setting.user-sessions-section.current")}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">{getFormattedSessionId(userSession.sessionId)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>{userSession.lastAccessedTime?.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>
                            {getSessionExpirationDate(userSession)?.toLocaleString() ?? t("setting.user-sessions-section.never")}
                            {isSessionExpired(userSession) && <span className="ml-2 text-red-600 text-xs">(Expired)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm">
                        <Button
                          variant="plain"
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
                          <TrashIcon className={`w-4 h-auto ${isCurrentSession(userSession) ? "text-gray-400" : "text-red-600"}`} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {userSessions.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t("setting.user-sessions-section.no-sessions")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSessionsSection;
