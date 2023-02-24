import { useEffect, useState } from "react";
import { Button, Divider, Input, Radio, RadioGroup, Typography } from "@mui/joy";
import * as api from "../helpers/api";
import { UNKNOWN_ID } from "../helpers/consts";
import { absolutifyLink } from "../helpers/utils";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import toastHelper from "./Toast";

interface Props extends DialogProps {
  identityProvider?: IdentityProvider;
  confirmCallback?: () => void;
}

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
          identifier: "login",
          displayName: "name",
          email: "email",
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
          identifier: "email",
          displayName: "name",
          email: "email",
        },
      },
    },
  },
  {
    id: UNKNOWN_ID,
    name: "Custom",
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

const CreateIdentityProviderDialog: React.FC<Props> = (props: Props) => {
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
  const [seletedTemplate, setSelectedTemplate] = useState<string>("GitHub");
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

    const template = templateList.find((t) => t.name === seletedTemplate);
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
  }, [seletedTemplate]);

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
        toastHelper.info(`SSO ${basicInfo.name} created`);
      } else {
        await api.patchIdentityProvider({
          id: identityProvider?.id,
          type: type,
          ...basicInfo,
          config: {
            oauth2Config: {
              ...oauth2Config,
              scopes: oauth2Scopes.split(" "),
            },
          },
        });
        toastHelper.info(`SSO ${basicInfo.name} updated`);
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
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
        <p className="title-text">{isCreating ? "Create SSO" : "Update SSO"}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container w-full max-w-[24rem]">
        {isCreating && (
          <>
            <Typography className="!mb-1" level="body2">
              Type
            </Typography>
            <RadioGroup className="mb-2" value={type}>
              <div className="mt-2 w-full flex flex-row space-x-4">
                <Radio value="OAUTH2" label="OAuth 2.0" />
              </div>
            </RadioGroup>
            <Typography className="mb-2" level="body2">
              Template
            </Typography>
            <RadioGroup className="mb-2" value={seletedTemplate}>
              <div className="mt-2 w-full flex flex-row space-x-4">
                {templateList.map((template) => (
                  <Radio
                    key={template.name}
                    value={template.name}
                    label={template.name}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  />
                ))}
              </div>
            </RadioGroup>
            <Divider className="!my-2" />
          </>
        )}
        <Typography className="!mb-1" level="body2">
          Name<span className="text-red-600">*</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="Name"
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
          Identifier filter
        </Typography>
        <Input
          className="mb-2"
          placeholder="Identifier filter"
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
              <p className="border rounded-md p-2 text-sm w-full mb-2 break-all">Redirect URL: {absolutifyLink("/auth/callback")}</p>
            )}
            <Typography className="!mb-1" level="body2">
              Client ID<span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder="Client ID"
              value={oauth2Config.clientId}
              onChange={(e) => setPartialOAuth2Config({ clientId: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              Client secret<span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder="Client secret"
              value={oauth2Config.clientSecret}
              onChange={(e) => setPartialOAuth2Config({ clientSecret: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              Authorization endpoint<span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder="Authorization endpoint"
              value={oauth2Config.authUrl}
              onChange={(e) => setPartialOAuth2Config({ authUrl: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              Token endpoint<span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder="Token endpoint"
              value={oauth2Config.tokenUrl}
              onChange={(e) => setPartialOAuth2Config({ tokenUrl: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              User info endpoint<span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder="User info endpoint"
              value={oauth2Config.userInfoUrl}
              onChange={(e) => setPartialOAuth2Config({ userInfoUrl: e.target.value })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              Scopes<span className="text-red-600">*</span>
            </Typography>
            <Input className="mb-2" placeholder="Scopes" value={oauth2Scopes} onChange={(e) => setOAuth2Scopes(e.target.value)} fullWidth />
            <Divider className="!my-2" />
            <Typography className="!mb-1" level="body2">
              Identifier<span className="text-red-600">*</span>
            </Typography>
            <Input
              className="mb-2"
              placeholder="User ID key"
              value={oauth2Config.fieldMapping.identifier}
              onChange={(e) => setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, identifier: e.target.value } })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              Display name
            </Typography>
            <Input
              className="mb-2"
              placeholder="User name key"
              value={oauth2Config.fieldMapping.displayName}
              onChange={(e) => setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, displayName: e.target.value } })}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              Email
            </Typography>
            <Input
              className="mb-2"
              placeholder="User email key"
              value={oauth2Config.fieldMapping.email}
              onChange={(e) => setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, email: e.target.value } })}
              fullWidth
            />
          </>
        )}
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
            Cancel
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
            {isCreating ? "Create" : "Update"}
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
