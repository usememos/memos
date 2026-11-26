import { create } from "@bufbuild/protobuf";
import i18next, { type TOptions } from "i18next";
import { describe, expect, it } from "vitest";
import { buildOAuth2SummaryItems } from "@/components/Settings/sso-display";
import plTranslation from "@/locales/pl.json";
import ruTranslation from "@/locales/ru.json";
import { OAuth2ConfigSchema } from "@/types/proto/api/idp_service_pb";

const scopeSummary = async (lng: string, translation: Record<string, unknown>, count: number) => {
  const i18n = i18next.createInstance();
  await i18n.init({ lng, fallbackLng: false, resources: { [lng]: { translation } }, interpolation: { escapeValue: false } });
  const config = create(OAuth2ConfigSchema, { scopes: Array.from({ length: count }, (_, index) => `scope-${index}`) });
  const items = buildOAuth2SummaryItems(config, "", (key, params) => String(i18n.t(key, params as TOptions)));
  return items.find((item) => item.key === "scopes")?.value;
};

describe("SSO provider summary", () => {
  it("lets the locale pick the plural form of the scope count", async () => {
    expect(await scopeSummary("ru", ruTranslation, 1)).toBe("1 область");
    expect(await scopeSummary("ru", ruTranslation, 3)).toBe("3 области");
    expect(await scopeSummary("ru", ruTranslation, 5)).toBe("5 областей");
    expect(await scopeSummary("pl", plTranslation, 2)).toBe("2 zakresy");
    expect(await scopeSummary("pl", plTranslation, 12)).toBe("12 zakresów");
  });
});
