import { test, expect } from "@playwright/test";
import { Review, login, writeMemo } from "../action";

test.beforeEach(async ({ page }) => {
  await login(page, "admin", "admin");
});

test("Write some memos", async ({ page }) => {
  await writeMemo(page, "something nice");
  await expect(page.getByText("something nice")).toBeVisible();
});

test("Daily Review", async ({ page }) => {
  // create a random string to content
  const content = Math.random().toString(36).substring(7);
  await writeMemo(page, content);
  await Review(page);
  await expect(page.getByText(content)).toBeVisible();
});
