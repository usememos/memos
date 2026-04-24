import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import InfoChip from "@/components/Settings/InfoChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { identityProviderServiceClient, userServiceClient } from "@/connect";
import { getIdentityProviderTypeLabel, getSSOProviderUid } from "@/helpers/sso-display";
import { absolutifyLink } from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import { handleError } from "@/lib/error";
import { IdentityProvider, IdentityProvider_Type } from "@/types/proto/api/v1/idp_service_pb";
import { LinkedIdentity } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { storeOAuthState } from "@/utils/oauth";
import SettingGroup from "./SettingGroup";
import SettingTable from "./SettingTable";

interface LinkedIdentityRow extends Record<string, unknown> {
  name: string;
  providerUid: string;
  title: string;
  typeLabel: string;
  externUid: string;
  isLinked: boolean;
  linkedIdentity?: LinkedIdentity;
  identityProvider: IdentityProvider;
}

const LinkedIdentitySection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const [linkedIdentityList, setLinkedIdentityList] = useState<LinkedIdentity[]>([]);

  const fetchData = async () => {
    if (!currentUser?.name) {
      return;
    }
    const [{ identityProviders }, { linkedIdentities }] = await Promise.all([
      identityProviderServiceClient.listIdentityProviders({}),
      userServiceClient.listLinkedIdentities({ parent: currentUser.name }),
    ]);
    setIdentityProviderList(identityProviders);
    setLinkedIdentityList(linkedIdentities);
  };

  useEffect(() => {
    if (!currentUser?.name) {
      return;
    }
    fetchData().catch((error: unknown) => {
      handleError(error, toast.error, {
        context: "Load linked identities",
      });
    });
  }, [currentUser?.name]);

  const oauthIdentityProviders = useMemo(
    () => identityProviderList.filter((identityProvider) => identityProvider.type === IdentityProvider_Type.OAUTH2),
    [identityProviderList],
  );

  const linkedIdentityByProviderName = useMemo(() => {
    const mapping = new Map<string, LinkedIdentity>();
    for (const linkedIdentity of linkedIdentityList) {
      if (!mapping.has(linkedIdentity.idpName)) {
        mapping.set(linkedIdentity.idpName, linkedIdentity);
      }
    }
    return mapping;
  }, [linkedIdentityList]);

  const rows = useMemo<LinkedIdentityRow[]>(
    () =>
      oauthIdentityProviders.map((identityProvider) => {
        const linkedIdentity = linkedIdentityByProviderName.get(identityProvider.name);
        return {
          name: identityProvider.name,
          providerUid: getSSOProviderUid(identityProvider.name),
          title: identityProvider.title,
          typeLabel: getIdentityProviderTypeLabel(identityProvider.type),
          externUid: linkedIdentity?.externUid ?? "",
          isLinked: !!linkedIdentity,
          linkedIdentity,
          identityProvider,
        };
      }),
    [linkedIdentityByProviderName, oauthIdentityProviders],
  );

  const handleLinkIdentityProvider = async (identityProvider: IdentityProvider) => {
    if (!currentUser?.name) {
      return;
    }
    const redirectUri = absolutifyLink("/auth/callback");
    const oauth2Config = identityProvider.config?.config?.case === "oauth2Config" ? identityProvider.config.config.value : undefined;
    if (!oauth2Config) {
      toast.error("Identity provider configuration is invalid.");
      return;
    }

    try {
      const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const { state, codeChallenge } = await storeOAuthState(identityProvider.name, "link", returnUrl, currentUser.name);

      let authUrl = `${oauth2Config.authUrl}?client_id=${
        oauth2Config.clientId
      }&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=${encodeURIComponent(
        oauth2Config.scopes.join(" "),
      )}`;

      if (codeChallenge) {
        authUrl += `&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      }

      window.location.href = authUrl;
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to initiate OAuth flow",
        fallbackMessage: "Failed to initiate account linking. Please try again.",
      });
    }
  };

  const handleUnlinkIdentityProvider = async (row: LinkedIdentityRow) => {
    if (!row.linkedIdentity?.name) {
      return;
    }
    try {
      await userServiceClient.deleteLinkedIdentity({
        name: row.linkedIdentity.name,
      });
      await fetchData();
      toast.success(t("setting.sso.unlink-success", { name: row.title }));
    } catch (error) {
      handleError(error, toast.error, {
        context: "Delete linked identity",
        fallbackMessage: "Failed to unlink identity provider.",
      });
    }
  };

  return (
    <SettingGroup showSeparator title={t("setting.sso.accounts-title")} description={t("setting.sso.accounts-description")}>
      <SettingTable<LinkedIdentityRow>
        variant="info-flow"
        columns={[
          {
            key: "title",
            header: t("setting.sso.provider"),
            render: (_, row: LinkedIdentityRow) => (
              <div className="flex min-w-[16rem] flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{row.title}</span>
                  <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                    {row.typeLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <InfoChip label={t("setting.sso.provider-uid")} value={row.providerUid} />
                </div>
              </div>
            ),
          },
          {
            key: "externUid",
            header: t("setting.sso.account"),
            render: (_, row: LinkedIdentityRow) => (
              <div className="flex min-w-[22rem] flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.isLinked ? "default" : "outline"} className="rounded-full px-2.5 py-0.5">
                    {row.isLinked ? t("setting.sso.linked") : t("setting.sso.not-linked")}
                  </Badge>
                  {row.isLinked && row.externUid ? (
                    <InfoChip label={t("setting.sso.extern-uid")} value={row.externUid} tooltip={row.externUid} />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.isLinked ? t("setting.sso.extern-uid-description") : t("setting.sso.not-linked-description")}
                </p>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-px text-right",
            render: (_, row: LinkedIdentityRow) =>
              row.linkedIdentity ? (
                <Button variant="outline" size="sm" onClick={() => handleUnlinkIdentityProvider(row)}>
                  {t("common.unlink")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleLinkIdentityProvider(row.identityProvider)}>
                  {t("common.link")}
                </Button>
              ),
          },
        ]}
        data={rows}
        emptyMessage={t("setting.sso.no-sso-found")}
        getRowKey={(row) => row.name}
      />
    </SettingGroup>
  );
};

export default LinkedIdentitySection;
