import { extractIdentityProviderUidFromName } from "@/helpers/resource-names";
import { type FieldMapping, type IdentityProvider, IdentityProvider_Type, type OAuth2Config } from "@/types/proto/api/v1/idp_service_pb";
import type { Translations } from "@/utils/i18n";

type Translate = (key: Translations, params?: Record<string, unknown>) => string;

export interface SummaryItem {
  key: string;
  label: string;
  value: string;
  tooltip?: string;
}

const SUMMARY_TEXT_MAX = 48;
export function getSSOProviderUid(name: string): string {
  return extractIdentityProviderUidFromName(name);
}

export function getIdentityProviderTypeLabel(type: IdentityProvider_Type): string {
  switch (type) {
    case IdentityProvider_Type.OAUTH2:
      return "OAuth2";
    default:
      return "Unknown";
  }
}

export function getEndpointSummary(url: string): string {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.host}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function getFieldMappingSummary(mapping: FieldMapping | undefined, t: Translate): string {
  if (!mapping?.identifier) {
    return t("setting.sso.mapping-none");
  }

  const parts = [`${t("setting.sso.mapping-identifier-short")}=${mapping.identifier}`];
  if (mapping.displayName) {
    parts.push(`${t("setting.sso.mapping-display-name-short")}=${mapping.displayName}`);
  }
  if (mapping.email) {
    parts.push(`${t("setting.sso.mapping-email-short")}=${mapping.email}`);
  }
  if (mapping.avatarUrl) {
    parts.push(`${t("setting.sso.mapping-avatar-short")}=${mapping.avatarUrl}`);
  }
  return parts.join(" · ");
}

export function getIdentifierFilterSummary(filter: string, t: Translate): string {
  if (!filter) {
    return t("setting.sso.filter-disabled");
  }
  return truncateMiddle(filter, SUMMARY_TEXT_MAX);
}

export function getOAuth2SummaryItems(provider: IdentityProvider, t: Translate): SummaryItem[] {
  const oauth2Config = provider.config?.config.case === "oauth2Config" ? provider.config.config.value : undefined;
  if (!oauth2Config) {
    return [];
  }

  return buildOAuth2SummaryItems(oauth2Config, provider.identifierFilter, t);
}

export function buildOAuth2SummaryItems(oauth2Config: OAuth2Config, identifierFilter: string, t: Translate): SummaryItem[] {
  const endpointSummaries = [oauth2Config.authUrl, oauth2Config.tokenUrl, oauth2Config.userInfoUrl].map(getEndpointSummary).filter(Boolean);
  const uniqueEndpointSummaries = [...new Set(endpointSummaries)];

  return [
    {
      key: "endpoints",
      label: t("setting.sso.endpoints"),
      value: uniqueEndpointSummaries.join(" · "),
      tooltip: [oauth2Config.authUrl, oauth2Config.tokenUrl, oauth2Config.userInfoUrl].filter(Boolean).join("\n"),
    },
    {
      key: "mapping",
      label: t("setting.sso.mapping"),
      value: getFieldMappingSummary(oauth2Config.fieldMapping, t),
      tooltip: oauth2Config.fieldMapping ? getFieldMappingSummary(oauth2Config.fieldMapping, t) : undefined,
    },
    {
      key: "scopes",
      label: t("setting.sso.scopes"),
      value:
        oauth2Config.scopes.length === 1
          ? t("setting.sso.scope-count_one", { count: oauth2Config.scopes.length })
          : t("setting.sso.scope-count_other", { count: oauth2Config.scopes.length }),
      tooltip: oauth2Config.scopes.length > 0 ? oauth2Config.scopes.join("\n") : undefined,
    },
    ...(identifierFilter
      ? [
          {
            key: "filter",
            label: t("setting.sso.identifier-filter"),
            value: getIdentifierFilterSummary(identifierFilter, t),
            tooltip: identifierFilter,
          },
        ]
      : []),
  ].filter((item) => item.value);
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const prefixLength = Math.ceil((maxLength - 1) / 2);
  const suffixLength = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, prefixLength)}…${value.slice(-suffixLength)}`;
}
