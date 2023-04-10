import { test } from "@playwright/test";
import { signUp } from "./utils";

test.use({
  locale: "en-US",
  timezoneId: "Europe/Berlin",
});

test.describe("Sign up a host account", async () => {
  test("Sign Up", async ({ page }) => {
    await signUp(page, "admin", "admin");
  });
});
