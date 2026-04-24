import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { identityProviderServiceClient } from "@/connect";
import { absolutifyLink } from "@/helpers/utils";
import { handleError } from "@/lib/error";
import {
  FieldMapping,
  FieldMappingSchema,
  IdentityProvider,
  IdentityProvider_Type,
  IdentityProviderConfigSchema,
  IdentityProviderSchema,
  OAuth2Config,
  OAuth2ConfigSchema,
} from "@/types/proto/api/v1/idp_service_pb";
import { useTranslate } from "@/utils/i18n";

const DEFAULT_TEMPLATE = "GitHub";

const templateList: IdentityProvider[] = [
  create(IdentityProviderSchema, {
    name: "",
    title: "GitHub",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: create(IdentityProviderConfigSchema, {
      config: {
        case: "oauth2Config",
        value: create(OAuth2ConfigSchema, {
          clientId: "",
          clientSecret: "",
          authUrl: "https://github.com/login/oauth/authorize",
          tokenUrl: "https://github.com/login/oauth/access_token",
          userInfoUrl: "https://api.github.com/user",
          scopes: ["read:user"],
          fieldMapping: create(FieldMappingSchema, {
            identifier: "login",
            displayName: "name",
            email: "email",
          }),
        }),
      },
    }),
  }),
  create(IdentityProviderSchema, {
    name: "",
    title: "GitLab",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: create(IdentityProviderConfigSchema, {
      config: {
        case: "oauth2Config",
        value: create(OAuth2ConfigSchema, {
          clientId: "",
          clientSecret: "",
          authUrl: "https://gitlab.com/oauth/authorize",
          tokenUrl: "https://gitlab.com/oauth/token",
          userInfoUrl: "https://gitlab.com/oauth/userinfo",
          scopes: ["openid"],
          fieldMapping: create(FieldMappingSchema, {
            identifier: "name",
            displayName: "name",
            email: "email",
          }),
        }),
      },
    }),
  }),
  create(IdentityProviderSchema, {
    name: "",
    title: "Google",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: create(IdentityProviderConfigSchema, {
      config: {
        case: "oauth2Config",
        value: create(OAuth2ConfigSchema, {
          clientId: "",
          clientSecret: "",
          authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          tokenUrl: "https://oauth2.googleapis.com/token",
          userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
          scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
          fieldMapping: create(FieldMappingSchema, {
            identifier: "email",
            displayName: "name",
            email: "email",
          }),
        }),
      },
    }),
  }),
  create(IdentityProviderSchema, {
    name: "",
    title: "Custom",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: create(IdentityProviderConfigSchema, {
      config: {
        case: "oauth2Config",
        value: create(OAuth2ConfigSchema, {
          clientId: "",
          clientSecret: "",
          authUrl: "",
          tokenUrl: "",
          userInfoUrl: "",
          scopes: [],
          fieldMapping: create(FieldMappingSchema, {
            identifier: "",
            displayName: "",
            email: "",
          }),
        }),
      },
    }),
  }),
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identityProvider?: IdentityProvider;
  onSuccess?: () => void;
}

interface BasicInfoState {
  title: string;
  identifier: string;
  identifierFilter: string;
}

function createEmptyFieldMapping(): FieldMapping {
  return create(FieldMappingSchema, {
    identifier: "",
    displayName: "",
    email: "",
    avatarUrl: "",
  });
}

function createEmptyOAuth2Config(): OAuth2Config {
  return create(OAuth2ConfigSchema, {
    clientId: "",
    clientSecret: "",
    authUrl: "",
    tokenUrl: "",
    userInfoUrl: "",
    scopes: [],
    fieldMapping: createEmptyFieldMapping(),
  });
}

function createEmptyBasicInfo(): BasicInfoState {
  return {
    title: "",
    identifier: "",
    identifierFilter: "",
  };
}

function sanitizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeScopes(value: string): string[] {
  return value
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function buildDialogStateFromTemplate(templateName: string) {
  const template = templateList.find((item) => item.title === templateName) ?? templateList[0];
  const oauth2Config =
    template.type === IdentityProvider_Type.OAUTH2 && template.config?.config.case === "oauth2Config"
      ? create(OAuth2ConfigSchema, template.config.config.value)
      : createEmptyOAuth2Config();

  return {
    basicInfo: {
      title: template.title,
      identifier: sanitizeIdentifier(template.title),
      identifierFilter: template.identifierFilter,
    },
    type: template.type,
    oauth2Config,
    oauth2Scopes: oauth2Config.scopes.join(" "),
  };
}

function buildDialogStateFromProvider(identityProvider: IdentityProvider) {
  const oauth2Config =
    identityProvider.type === IdentityProvider_Type.OAUTH2 && identityProvider.config?.config.case === "oauth2Config"
      ? create(OAuth2ConfigSchema, identityProvider.config.config.value)
      : createEmptyOAuth2Config();

  return {
    basicInfo: {
      title: identityProvider.title,
      identifier: "",
      identifierFilter: identityProvider.identifierFilter,
    },
    type: identityProvider.type,
    oauth2Config,
    oauth2Scopes: oauth2Config.scopes.join(" "),
  };
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required = false,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function CreateIdentityProviderDialog({ open, onOpenChange, identityProvider, onSuccess }: Props) {
  const t = useTranslate();
  const identityProviderTypes = [...new Set(templateList.map((template) => template.type))];
  const [basicInfo, setBasicInfo] = useState<BasicInfoState>(createEmptyBasicInfo);
  const [type, setType] = useState<IdentityProvider_Type>(IdentityProvider_Type.OAUTH2);
  const [oauth2Config, setOAuth2Config] = useState<OAuth2Config>(createEmptyOAuth2Config);
  const [oauth2Scopes, setOAuth2Scopes] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCreating = identityProvider === undefined;
  const oauth2FieldMapping = oauth2Config.fieldMapping ?? createEmptyFieldMapping();

  useEffect(() => {
    if (!open) {
      setSelectedTemplate(DEFAULT_TEMPLATE);
      setBasicInfo(createEmptyBasicInfo());
      setType(IdentityProvider_Type.OAUTH2);
      setOAuth2Config(createEmptyOAuth2Config());
      setOAuth2Scopes("");
      setIsSubmitting(false);
      return;
    }

    const nextState = isCreating ? buildDialogStateFromTemplate(selectedTemplate) : buildDialogStateFromProvider(identityProvider!);
    setBasicInfo(nextState.basicInfo);
    setType(nextState.type);
    setOAuth2Config(nextState.oauth2Config);
    setOAuth2Scopes(nextState.oauth2Scopes);
  }, [open, isCreating, identityProvider, selectedTemplate]);

  const handleDialogClose = (nextOpen: boolean) => {
    if (isSubmitting && !nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleCloseBtnClick = () => {
    if (isSubmitting) {
      return;
    }
    handleDialogClose(false);
  };

  const allowConfirmAction = () => {
    if (basicInfo.title.trim() === "") {
      return false;
    }
    if (isCreating && basicInfo.identifier.trim() === "") {
      return false;
    }
    if (type === IdentityProvider_Type.OAUTH2) {
      if (
        oauth2Config.clientId.trim() === "" ||
        oauth2Config.authUrl.trim() === "" ||
        oauth2Config.tokenUrl.trim() === "" ||
        oauth2Config.userInfoUrl.trim() === "" ||
        normalizeScopes(oauth2Scopes).length === 0 ||
        oauth2FieldMapping.identifier.trim() === ""
      ) {
        return false;
      }
      if (isCreating && oauth2Config.clientSecret.trim() === "") {
        return false;
      }
    }

    return !isSubmitting;
  };

  const handleConfirmBtnClick = async () => {
    setIsSubmitting(true);
    const normalizedScopes = normalizeScopes(oauth2Scopes);

    try {
      if (isCreating) {
        await identityProviderServiceClient.createIdentityProvider({
          identityProviderId: basicInfo.identifier,
          identityProvider: create(IdentityProviderSchema, {
            title: basicInfo.title.trim(),
            identifierFilter: basicInfo.identifierFilter.trim(),
            type,
            config: create(IdentityProviderConfigSchema, {
              config: {
                case: "oauth2Config",
                value: {
                  ...oauth2Config,
                  scopes: normalizedScopes,
                },
              },
            }),
          }),
        });
        toast.success(t("setting.sso.sso-created", { name: basicInfo.title }));
      } else {
        await identityProviderServiceClient.updateIdentityProvider({
          identityProvider: create(IdentityProviderSchema, {
            name: identityProvider!.name,
            title: basicInfo.title.trim(),
            identifierFilter: basicInfo.identifierFilter.trim(),
            type,
            config: create(IdentityProviderConfigSchema, {
              config: {
                case: "oauth2Config",
                value: {
                  ...oauth2Config,
                  scopes: normalizedScopes,
                },
              },
            }),
          }),
          updateMask: create(FieldMaskSchema, { paths: ["title", "identifier_filter", "config"] }),
        });
        toast.success(t("setting.sso.sso-updated", { name: basicInfo.title }));
      }
    } catch (error: unknown) {
      setIsSubmitting(false);
      await handleError(error, toast.error, {
        context: isCreating ? "Create identity provider" : "Update identity provider",
      });
      return;
    }

    setIsSubmitting(false);
    onSuccess?.();
    handleDialogClose(false);
  };

  const setPartialOAuth2Config = (state: Partial<OAuth2Config>) => {
    setOAuth2Config((current) => ({
      ...current,
      ...state,
    }));
  };

  const setPartialFieldMapping = (state: Partial<FieldMapping>) => {
    setPartialOAuth2Config({
      fieldMapping: {
        ...oauth2FieldMapping,
        ...state,
      } as FieldMapping,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{t(isCreating ? "setting.sso.create-sso" : "setting.sso.update-sso")}</DialogTitle>
          <DialogDescription>
            {t(isCreating ? "setting.sso.create-sso-description" : "setting.sso.update-sso-description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormSection title={t("setting.sso.basic-settings")} description={t("setting.sso.basic-settings-description")}>
            {isCreating ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={t("common.type")} required>
                  <Select value={String(type)} onValueChange={(value) => setType(Number(value) as IdentityProvider_Type)}>
                    <SelectTrigger>
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
                </FormField>

                <FormField label={t("setting.sso.template")} required description={t("setting.sso.template-description")}>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
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
                </FormField>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {isCreating ? (
                <FormField label={t("setting.sso.provider-id")} required description={t("setting.sso.provider-id-description")}>
                  <Input
                    className="font-mono"
                    placeholder="e.g. github, okta-corp"
                    maxLength={32}
                    value={basicInfo.identifier}
                    onChange={(e) =>
                      setBasicInfo((current) => ({
                        ...current,
                        identifier: sanitizeIdentifier(e.target.value),
                      }))
                    }
                  />
                </FormField>
              ) : null}

              <FormField label={t("common.name")} required>
                <Input
                  placeholder={t("common.name")}
                  value={basicInfo.title}
                  onChange={(e) =>
                    setBasicInfo((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>

            <FormField label={t("setting.sso.identifier-filter")} description={t("setting.sso.identifier-filter-description")}>
              <Input
                placeholder={t("setting.sso.identifier-filter")}
                value={basicInfo.identifierFilter}
                onChange={(e) =>
                  setBasicInfo((current) => ({
                    ...current,
                    identifierFilter: e.target.value,
                  }))
                }
              />
            </FormField>
          </FormSection>

          {type === IdentityProvider_Type.OAUTH2 ? (
            <>
              <FormSection title={t("setting.sso.oauth-configuration")} description={t("setting.sso.oauth-configuration-description")}>
                <div className="rounded-md border bg-background px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("setting.sso.redirect-url")}</p>
                  <p className="mt-2 break-all font-mono text-xs text-foreground sm:text-sm">{absolutifyLink("/auth/callback")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{t("setting.sso.redirect-url-description")}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label={t("setting.sso.client-id")} required>
                    <Input
                      placeholder={t("setting.sso.client-id")}
                      value={oauth2Config.clientId}
                      onChange={(e) => setPartialOAuth2Config({ clientId: e.target.value })}
                    />
                  </FormField>

                  <FormField
                    label={t("setting.sso.client-secret")}
                    required={isCreating}
                    description={isCreating ? undefined : t("setting.sso.client-secret-optional-description")}
                  >
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder={t("setting.sso.client-secret")}
                      value={oauth2Config.clientSecret}
                      onChange={(e) => setPartialOAuth2Config({ clientSecret: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label={t("setting.sso.authorization-endpoint")} required>
                    <Input
                      placeholder={t("setting.sso.authorization-endpoint")}
                      value={oauth2Config.authUrl}
                      onChange={(e) => setPartialOAuth2Config({ authUrl: e.target.value })}
                    />
                  </FormField>

                  <FormField label={t("setting.sso.token-endpoint")} required>
                    <Input
                      placeholder={t("setting.sso.token-endpoint")}
                      value={oauth2Config.tokenUrl}
                      onChange={(e) => setPartialOAuth2Config({ tokenUrl: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label={t("setting.sso.user-endpoint")} required>
                    <Input
                      placeholder={t("setting.sso.user-endpoint")}
                      value={oauth2Config.userInfoUrl}
                      onChange={(e) => setPartialOAuth2Config({ userInfoUrl: e.target.value })}
                    />
                  </FormField>

                  <FormField label={t("setting.sso.scopes")} required description={t("setting.sso.scopes-description")}>
                    <Input placeholder={t("setting.sso.scopes")} value={oauth2Scopes} onChange={(e) => setOAuth2Scopes(e.target.value)} />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title={t("setting.sso.field-mapping")} description={t("setting.sso.field-mapping-description")}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label={t("setting.sso.identifier")}
                    required
                    description={t("setting.sso.field-mapping-identifier-description")}
                  >
                    <Input
                      placeholder={t("setting.sso.identifier")}
                      value={oauth2FieldMapping.identifier}
                      onChange={(e) => setPartialFieldMapping({ identifier: e.target.value })}
                    />
                  </FormField>

                  <FormField label={t("setting.sso.display-name")}>
                    <Input
                      placeholder={t("setting.sso.display-name")}
                      value={oauth2FieldMapping.displayName}
                      onChange={(e) => setPartialFieldMapping({ displayName: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label={t("common.email")}>
                    <Input
                      placeholder={t("common.email")}
                      value={oauth2FieldMapping.email}
                      onChange={(e) => setPartialFieldMapping({ email: e.target.value })}
                    />
                  </FormField>

                  <FormField label={t("setting.sso.avatar-url")}>
                    <Input
                      placeholder={t("setting.sso.avatar-url")}
                      value={oauth2FieldMapping.avatarUrl}
                      onChange={(e) => setPartialFieldMapping({ avatarUrl: e.target.value })}
                    />
                  </FormField>
                </div>
              </FormSection>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCloseBtnClick} disabled={isSubmitting}>
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
