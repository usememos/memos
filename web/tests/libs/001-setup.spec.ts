import { test } from "@playwright/test";
import { SignIn } from "../action";

test.use({
  locale: "en-US",
  timezoneId: "Europe/Berlin",
});

test.describe("Sign in", async () => {
  test("Sign In", async ({ page }) => {
    await SignIn(page, "admin", "admin");
  });
});
