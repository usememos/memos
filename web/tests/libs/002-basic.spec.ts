import { test, expect } from "@playwright/test";
import { Review, login, writeMemo } from "../action";

test.beforeEach(async ({ page }) => {
  await login(page, "admin", "admin");
});

test("Write some memos", async ({ page }) => {
  const content = Math.random().toString(36).substring(7);
  await writeMemo(page, content);
  await expect(page.getByText(content)).toBeVisible();
});

test("Daily Review", async ({ page }) => {
  const content = Math.random().toString(36).substring(7);
  await writeMemo(page, content);
  await Review(page);
  await expect(page.getByText(content)).toBeVisible();
});
