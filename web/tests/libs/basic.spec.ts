import { test, expect } from "@playwright/test";
import { login, writeMemo } from "../action";

test.beforeEach(async ({ page }) => {
  await login(page, "admin", "admin");
});

test("basic test", async ({ page }) => {
  await writeMemo(page, "something nice");
  await expect(page.getByText("something nice")).toBeVisible();
});
