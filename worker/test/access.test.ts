import { describe, expect, it } from "vitest";
import { normalizeTeamDomain } from "../src/auth/access";

describe("normalizeTeamDomain", () => {
  it("accepts the bare team slug", () => {
    expect(normalizeTeamDomain("yugai")).toBe("yugai");
  });

  it("strips a full cloudflareaccess.com host", () => {
    expect(normalizeTeamDomain("yugai.cloudflareaccess.com")).toBe("yugai");
  });

  it("strips protocol and trailing path", () => {
    expect(normalizeTeamDomain("https://yugai.cloudflareaccess.com/")).toBe("yugai");
    expect(normalizeTeamDomain("  https://yugai.cloudflareaccess.com/cdn-cgi/access/certs  ")).toBe("yugai");
  });
});
