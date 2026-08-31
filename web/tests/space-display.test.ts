import { describe, expect, it } from "vitest";
import { extractSpaceUidFromName, formatSpaceUidForDisplay, getDuplicateSpaceTitles } from "@/lib/space-display";

describe("Space display identity", () => {
  it("keeps short custom UIDs intact and compacts UUIDs to eight visible hex characters", () => {
    expect(extractSpaceUidFromName("spaces/research-notes")).toBe("research-notes");
    expect(formatSpaceUidForDisplay("spaces/research-notes")).toBe("research-notes");
    expect(formatSpaceUidForDisplay("spaces/123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567…");
  });

  it("shows both ends of long custom UIDs", () => {
    expect(formatSpaceUidForDisplay("spaces/customer-support-production")).toBe("customer…uction");
    expect(formatSpaceUidForDisplay("spaces/customer-support-development")).toBe("customer…opment");
  });

  it("marks only titles that match exactly", () => {
    const duplicates = getDuplicateSpaceTitles([{ title: "Product" }, { title: "Research" }, { title: "Product" }, { title: "product" }]);

    expect([...duplicates]).toEqual(["Product"]);
  });
});
