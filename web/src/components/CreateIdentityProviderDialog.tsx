import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button, Divider, Input, Option, Select, Typography } from "@mui/joy";
import * as api from "@/helpers/api";
import { UNKNOWN_ID } from "@/helpers/consts";
import { absolutifyLink } from "@/helpers/utils";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import { useTranslation } from "react-i18next";

interface Props extends DialogProps {
  identityProvider?: IdentityProvider;
  confirmCallback?: () => void;
}

const CreateIdentityProviderDialog: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation();
  const templateList: IdentityProvider[] = [
    {
      id: UNKNOWN_ID,
      name: "GitHub",
      type: "OAUTH2",
      identifierFilter: "",
      config: {
        oauth2Config: {
          clientId: "",
          clientSecret: "",
          authUrl: "https://github.com/login/oauth/authorize",
          tokenUrl: "https://github.com/login/oauth/access_token",
          userInfoUrl: "https://api.github.com/user",
          scopes: ["user"],
          fieldMapping: {
            identifier: t("setting.sso-section.identifier"),
            displayName: "",
            email: "",
          },
        },
      },
    },
    {
      id: UNKNOWN_ID,
      name: "GitLab",
      type: "OAUTH2",
      identifierFilter: "",
      config: {
        oauth2Config: {
          clientId: "",
          clientSecret: "",
          authUrl: "https://gitlab.com/oauth/authorize",
          tokenUrl: "https://gitlab.com/oauth/token",
          userInfoUrl: "https://gitlab.com/oauth/userinfo",
          scopes: ["openid"],
          fieldMapping: {
            identifier: t("setting.sso-section.identifier"),
            displayName: "",
            email: "",
          },
        },
      },
    },
    {
      id: UNKNOWN_ID,
      name: "Google",
      type: "OAUTH2",
      identifierFilter: "",
      config: {
        oauth2Config: {
          clientId: "",
          clientSecret: "",
          authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          tokenUrl: "https://oauth2.googleapis.com/token",
          userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
          scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
          fieldMapping: {
            identifier: t("setting.sso-section.identifier"),
            displayName: "",
            email: "",
          },
        },
      },
    },
    {
      id: UNKNOWN_ID,
      name: t("setting.sso-section.custom"),
      type: "OAUTH2",
      identifierFilter: "",
      config: {
        oauth2Config: {
          clientId: "",
          clientSecret: "",
          authUrl: "",
          tokenUrl: "",
          userInfoUrl: "",
          scopes: [],
          fieldMapping: {
            identifier: "",
            displayName: "",
            email: "",
          },
        },
      },
    },
  ];
  const identityProviderTypes = [...new Set(templateList.map((t) => t.type))];
  const { confirmCallback, destroy, identityProvider } = props;
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    identifierFilter: "",
  });
  const [type, setType] = useState<IdentityProviderType>("OAUTH2");
  const [oauth2Config, setOAuth2Config] = useState<IdentityProviderOAuth2Config>({
    clientId: "",
    clientSecret: "",
    authUrl: "",
    tokenUrl: "",
    userInfoUrl: "",
    scopes: [],
    fieldMapping: {
      identifier: "",
      displayName: "",
      email: "",
    },
  });
  const [oauth2Scopes, setOAuth2Scopes] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("GitHub");
  const isCreating = identityProvider === undefined;

  useEffect(() => {
    if (identityProvider) {
      setBasicInfo({
        name: identityProvider.name,
        identifierFilter: identityProvider.identifierFilter,
      });
      setType(identityProvider.type);
      if (identityProvider.type === "OAUTH2") {
        setOAuth2Config(identityProvider.config.oauth2Config);
        setOAuth2Scopes(identityProvider.config.oauth2Config.scopes.join(" "));
      }
    }
  }, []);

  useEffect(() => {
    if (!isCreating) {
      return;
    }

    const template = templateList.find((t) => t.name === selectedTemplate);
    if (template) {
      setBasicInfo({
        name: template.name,
        identifierFilter: template.identifierFilter,
      });
      setType(template.type);
      if (template.type === "OAUTH2") {
        setOAuth2Config(template.config.oauth2Config);
        setOAuth2Scopes(template.config.oauth2Config.scopes.join(" "));
      }
    }
  }, [selectedTemplate]);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const allowConfirmAction = () => {
    if (basicInfo.name === "") {
      return false;
    }
    if (type === "OAUTH2") {
      if (
        oauth2Config.clientId === "" ||
        oauth2Config.clientSecret === "" ||
        oauth2Config.authUrl === "" ||
        oauth2Config.tokenUrl === "" ||
        oauth2Config.userInfoUrl === "" ||
        oauth2Scopes === "" ||
        oauth2Config.fieldMapping.identifier === ""
      ) {
        return false;
      }
    }
    return true;
  };

  const handleConfirmBtnClick = async () => {
    try {
      if (isCreating) {
        await api.createIdentityProvider({
          ...basicInfo,
          type: type,
          config: {
            oauth2Config: {
              ...oauth2Config,
              scopes: oauth2Scopes.split(" "),
            },
          },
        });
        toast.success(t("setting.sso-section.sso-created", { name: basicInfo.name }));
      } else {
        await api.patchIdentityProvider({
          id: identityProvider.id,
          type: type,
          ...basicInfo,
          config: {
            oauth2Config: {
              ...oauth2Config,
              scopes: oauth2Scopes.split(" "),
            },
          },
        });
        toast.success(t("setting.sso-section.sso-updated", { name: basicInfo.name }));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
    if (confirmCallback) {
      confirmCallback();
    }
    destroy();
  };

  const setPartialOAuth2Config = (state: Partial<IdentityProviderOAuth2Config>) => {
    setOAuth2Config({
      ...oauth2Config,
      ...state,
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text ml-auto">{t("setting.sso-section." + (isCreating ? "create" : "update") + "-sso")}</p>
        <button className="btn close-btn ml-auto" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container min-w-[19rem]">
        {isCreating && (
          <>
            <Typography className="!mb-1" level="body2">
              {t("common.type")}
            </Typography>
            <Select className="w-full mb-4" value={type} onChange={(_, e) => setType(e ?? type)}>
              {identityProviderTypes.map((kind) => (
                <Option key={kind} value={kind}>
                  {kind}
                </Option>
              ))}
            </Select>
            <Typography className="mb-2" level="body2">
              {t("setting.sso-section.template")}
            </Typography>
            <Select className="mb-1 h-auto w-full" value={selectedTemplate} onChange={(_, e) => setSelectedTemplate(e ?? selectedTemplate)}>
              {templateList.map((template) => (
                <Option key={template.name} value={template.name}>
                  {template.name}
                </Option>
              ))}
            </Select>
            <Divider className="!my-2" />
          </>
        )}
        <Typography className="!mb-1" level="body2">
          {t("common.name")}
          <span className="text-red-600">*</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("common.name")}
          value={basicInfo.name}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              name: e.target.value,
            })
          }
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          {t("setting.sso-section.identifier-filter")}
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.sso-section.identifier-filter")}
          value={basicInfo.identifierFilter}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              identifierFilter: e.target.value,
            })
          }
          fullWidth
        />
        <Divider className="!my-2" />
        {type === "OAUTH2" && (
          <>
            {isCreating && (
              <p className="border rounded-md p-2 text-sm w-full mb-2 break-all">
                {t("setting.sso-section.redirect-url")}: {absolutifyLink("/auth/callback")}
              </p>
            )}
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.client-id")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.client-id")}
              value={oauth2Config.clientId}
              onChange={(e) => setPartialOAuth2Config({ clientId: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.client-secret")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.client-secret")}
              value={oauth2Config.clientSecret}
              onChange={(e) => setPartialOAuth2Config({ clientSecret: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.authorization-endpoint")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.authorization-endpoint")}
              value={oauth2Config.authUrl}
              onChange={(e) => setPartialOAuth2Config({ authUrl: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.token-endpoint")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.token-endpoint")}
              value={oauth2Config.tokenUrl}
              onChange={(e) => setPartialOAuth2Config({ tokenUrl: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.user-endpoint")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.user-endpoint")}
              value={oauth2Config.userInfoUrl}
              onChange={(e) => setPartialOAuth2Config({ userInfoUrl: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.scopes")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.scopes")}
              value={oauth2Scopes}
              onChange={(e) => setOAuth2Scopes(e.target.value)}
              fullWidth
            />
            <Divider className="!my-2" />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.identifier")}
              <span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.identifier")}
              value={oauth2Config.fieldMapping.identifier}
              onChange={(e) => setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, identifier: e.target.value } })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("setting.sso-section.display-name")}
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("setting.sso-section.display-name")}
              value={oauth2Config.fieldMapping.displayName}
              onChange={(e) => setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, displayName: e.target.value } })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("common.email")}
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("common.email")}
              value={oauth2Config.fieldMapping.email}
              onChange={(e) => setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, email: e.target.value } })}
              fullWidth
            />
          </>
        )}
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
            {t("common." + (isCreating ? "create" : "update"))}
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateIdentityProviderDialog(identityProvider?: IdentityProvider, confirmCallback?: () => void) {
  generateDialog(
    {
      className: "create-identity-provider-dialog",
      dialogName: "create-identity-provider-dialog",
    },
    CreateIdentityProviderDialog,
    { identityProvider, confirmCallback }
  );
}

export default showCreateIdentityProviderDialog;
