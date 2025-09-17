import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { identityProviderServiceClient } from "@/grpcweb";
import { absolutifyLink } from "@/helpers/utils";
import { FieldMapping, IdentityProvider, IdentityProvider_Type, OAuth2Config } from "@/types/proto/api/v1/idp_service";
import { useTranslate } from "@/utils/i18n";

const templateList: IdentityProvider[] = [
  {
    name: "",
    title: "GitHub",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
        scopes: ["read:user"],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "login",
          displayName: "name",
          email: "email",
        }),
      },
    },
  },
  {
    name: "",
    title: "GitLab",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "https://gitlab.com/oauth/authorize",
        tokenUrl: "https://gitlab.com/oauth/token",
        userInfoUrl: "https://gitlab.com/oauth/userinfo",
        scopes: ["openid"],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "name",
          displayName: "name",
          email: "email",
        }),
      },
    },
  },
  {
    name: "",
    title: "Google",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "email",
          displayName: "name",
          email: "email",
        }),
      },
    },
  },
  {
    name: "",
    title: "Custom",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "",
        tokenUrl: "",
        userInfoUrl: "",
        scopes: [],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "",
          displayName: "",
          email: "",
        }),
      },
    },
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identityProvider?: IdentityProvider;
  onSuccess?: () => void;
}

function CreateIdentityProviderDialog({ open, onOpenChange, identityProvider, onSuccess }: Props) {
  const t = useTranslate();
  const identityProviderTypes = [...new Set(templateList.map((t) => t.type))];
  const [basicInfo, setBasicInfo] = useState({
    title: "",
    identifierFilter: "",
  });
  const [type, setType] = useState<IdentityProvider_Type>(IdentityProvider_Type.OAUTH2);
  const [oauth2Config, setOAuth2Config] = useState<OAuth2Config>({
    clientId: "",
    clientSecret: "",
    authUrl: "",
    tokenUrl: "",
    userInfoUrl: "",
    scopes: [],
    fieldMapping: FieldMapping.fromPartial({
      identifier: "",
      displayName: "",
      email: "",
    }),
  });
  const [oauth2Scopes, setOAuth2Scopes] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("GitHub");
  const isCreating = identityProvider === undefined;

  // Reset state when dialog is closed
  useEffect(() => {
    if (!open) {
      // Reset to default state when dialog is closed
      setBasicInfo({
        title: "",
        identifierFilter: "",
      });
      setType(IdentityProvider_Type.OAUTH2);
      setOAuth2Config({
        clientId: "",
        clientSecret: "",
        authUrl: "",
        tokenUrl: "",
        userInfoUrl: "",
        scopes: [],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "",
          displayName: "",
          email: "",
        }),
      });
      setOAuth2Scopes("");
      setSelectedTemplate("GitHub");
    }
  }, [open]);

  // Load existing identity provider data when editing
  useEffect(() => {
    if (open && identityProvider) {
      setBasicInfo({
        title: identityProvider.title,
        identifierFilter: identityProvider.identifierFilter,
      });
      setType(identityProvider.type);
      if (identityProvider.type === IdentityProvider_Type.OAUTH2) {
        const oauth2Config = OAuth2Config.fromPartial(identityProvider.config?.oauth2Config || {});
        setOAuth2Config(oauth2Config);
        setOAuth2Scopes(oauth2Config.scopes.join(" "));
      }
    }
  }, [open, identityProvider]);

  // Load template data when creating new IDP
  useEffect(() => {
    if (!isCreating || !open) {
      return;
    }

    const template = templateList.find((t) => t.title === selectedTemplate);
    if (template) {
      setBasicInfo({
        title: template.title,
        identifierFilter: template.identifierFilter,
      });
      setType(template.type);
      if (template.type === IdentityProvider_Type.OAUTH2) {
        const oauth2Config = OAuth2Config.fromPartial(template.config?.oauth2Config || {});
        setOAuth2Config(oauth2Config);
        setOAuth2Scopes(oauth2Config.scopes.join(" "));
      }
    }
  }, [selectedTemplate, isCreating, open]);

  const handleCloseBtnClick = () => {
    onOpenChange(false);
  };

  const allowConfirmAction = () => {
    if (basicInfo.title === "") {
      return false;
    }
    if (type === "OAUTH2") {
      if (
        oauth2Config.clientId === "" ||
        oauth2Config.authUrl === "" ||
        oauth2Config.tokenUrl === "" ||
        oauth2Config.userInfoUrl === "" ||
        oauth2Scopes === "" ||
        oauth2Config.fieldMapping?.identifier === ""
      ) {
        return false;
      }
      if (isCreating) {
        if (oauth2Config.clientSecret === "") {
          return false;
        }
      }
    }

    return true;
  };

  const handleConfirmBtnClick = async () => {
    try {
      if (isCreating) {
        await identityProviderServiceClient.createIdentityProvider({
          identityProvider: {
            ...basicInfo,
            type: type,
            config: {
              oauth2Config: {
                ...oauth2Config,
                scopes: oauth2Scopes.split(" "),
              },
            },
          },
        });
        toast.success(t("setting.sso-section.sso-created", { name: basicInfo.title }));
      } else {
        await identityProviderServiceClient.updateIdentityProvider({
          identityProvider: {
            ...basicInfo,
            name: identityProvider!.name,
            type: type,
            config: {
              oauth2Config: {
                ...oauth2Config,
                scopes: oauth2Scopes.split(" "),
              },
            },
          },
          updateMask: ["title", "identifier_filter", "config"],
        });
        toast.success(t("setting.sso-section.sso-updated", { name: basicInfo.title }));
      }
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
    }
    onSuccess?.();
    onOpenChange(false);
  };

  const setPartialOAuth2Config = (state: Partial<OAuth2Config>) => {
    setOAuth2Config({
      ...oauth2Config,
      ...state,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(isCreating ? "setting.sso-section.create-sso" : "setting.sso-section.update-sso")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col justify-start items-start w-full space-y-4">
          {isCreating && (
            <>
              <p className="mb-1!">{t("common.type")}</p>
              <Select value={String(type)} onValueChange={(value) => setType(parseInt(value) as unknown as IdentityProvider_Type)}>
                <SelectTrigger className="w-full mb-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {identityProviderTypes.map((kind) => (
                    <SelectItem key={kind} value={String(kind)}>
                      {IdentityProvider_Type[kind] || kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mb-2 text-sm font-medium">{t("setting.sso-section.template")}</p>
              <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value)}>
                <SelectTrigger className="mb-1 h-auto w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateList.map((template) => (
                    <SelectItem key={template.title} value={template.title}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Separator className="my-2" />
            </>
          )}
          <p className="mb-1 text-sm font-medium">
            {t("common.name")}
            <span className="text-destructive">*</span>
          </p>
          <Input
            className="mb-2 w-full"
            placeholder={t("common.name")}
            value={basicInfo.title}
            onChange={(e) =>
              setBasicInfo({
                ...basicInfo,
                title: e.target.value,
              })
            }
          />
          <p className="mb-1 text-sm font-medium">{t("setting.sso-section.identifier-filter")}</p>
          <Input
            className="mb-2 w-full"
            placeholder={t("setting.sso-section.identifier-filter")}
            value={basicInfo.identifierFilter}
            onChange={(e) =>
              setBasicInfo({
                ...basicInfo,
                identifierFilter: e.target.value,
              })
            }
          />
          <Separator className="my-2" />
          {type === "OAUTH2" && (
            <>
              {isCreating && (
                <p className="border border-border rounded-md p-2 text-sm w-full mb-2 break-all">
                  {t("setting.sso-section.redirect-url")}: {absolutifyLink("/auth/callback")}
                </p>
              )}
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.client-id")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.client-id")}
                value={oauth2Config.clientId}
                onChange={(e) => setPartialOAuth2Config({ clientId: e.target.value })}
              />
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.client-secret")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.client-secret")}
                value={oauth2Config.clientSecret}
                onChange={(e) => setPartialOAuth2Config({ clientSecret: e.target.value })}
              />
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.authorization-endpoint")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.authorization-endpoint")}
                value={oauth2Config.authUrl}
                onChange={(e) => setPartialOAuth2Config({ authUrl: e.target.value })}
              />
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.token-endpoint")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.token-endpoint")}
                value={oauth2Config.tokenUrl}
                onChange={(e) => setPartialOAuth2Config({ tokenUrl: e.target.value })}
              />
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.user-endpoint")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.user-endpoint")}
                value={oauth2Config.userInfoUrl}
                onChange={(e) => setPartialOAuth2Config({ userInfoUrl: e.target.value })}
              />
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.scopes")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.scopes")}
                value={oauth2Scopes}
                onChange={(e) => setOAuth2Scopes(e.target.value)}
              />
              <Separator className="my-2" />
              <p className="mb-1 text-sm font-medium">
                {t("setting.sso-section.identifier")}
                <span className="text-destructive">*</span>
              </p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.identifier")}
                value={oauth2Config.fieldMapping!.identifier}
                onChange={(e) =>
                  setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, identifier: e.target.value } as FieldMapping })
                }
              />
              <p className="mb-1 text-sm font-medium">{t("setting.sso-section.display-name")}</p>
              <Input
                className="mb-2 w-full"
                placeholder={t("setting.sso-section.display-name")}
                value={oauth2Config.fieldMapping!.displayName}
                onChange={(e) =>
                  setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, displayName: e.target.value } as FieldMapping })
                }
              />
              <p className="mb-1 text-sm font-medium">{t("common.email")}</p>
              <Input
                className="mb-2 w-full"
                placeholder={t("common.email")}
                value={oauth2Config.fieldMapping!.email}
                onChange={(e) =>
                  setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, email: e.target.value } as FieldMapping })
                }
              />
              <p className="mb-1 text-sm font-medium">Avatar URL</p>
              <Input
                className="mb-2 w-full"
                placeholder={"Avatar URL"}
                value={oauth2Config.fieldMapping!.avatarUrl}
                onChange={(e) =>
                  setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, avatarUrl: e.target.value } as FieldMapping })
                }
              />
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
            {t(isCreating ? "common.create" : "common.update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateIdentityProviderDialog;
