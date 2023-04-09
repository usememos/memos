import { test } from "@playwright/test";
import { SignIn, writeMemo } from "../action";

test.use({
  locale: "en-US",
  timezoneId: "Europe/Berlin",
});

test.describe("Basic Operator", async () => {
  test("Sign In and write first Memos", async ({ page }) => {
    await SignIn(page, "admin", "admin");
    await writeMemo(page, "Hello World");
  });
});
