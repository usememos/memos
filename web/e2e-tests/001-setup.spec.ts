import { test } from "@playwright/test";
import { SignUp } from "../action";

test.use({
  locale: "en-US",
  timezoneId: "Europe/Berlin",
});

test.describe("Sign up a host account", async () => {
  test("Sign In", async ({ page }) => {
    await SignUp(page, "admin", "admin");
  });
});
