import { test, expect } from "@playwright/test";
import { review, login, writeMemo } from "./utils";
import randomstring from "randomstring";

test.use({
  locale: "en-US",
  timezoneId: "Europe/Berlin",
});

test.beforeEach(async ({ page }) => {
  await login(page, "admin", "admin");
});

test.describe("Write some memos", async () => {
  test("Write memos", async ({ page }) => {
    const content = `${randomstring.generate()} from Write memos`;
    await writeMemo(page, content);
    await expect(page.getByText(content)).toBeVisible();
  });

  test("Write memos with Tag", async ({ page }) => {
    const tag = randomstring.generate(5);
    const content = `#${tag} ${randomstring.generate()} from Write memos with Tag`;
    await writeMemo(page, content);
    // 1.memo contentg 2.tags list of memos editor 3.tags list
    await expect(page.getByText(tag)).toHaveCount(3);
  });
});

test.describe("Daily Review", async () => {
  test("Daily Review", async ({ page }) => {
    const content = randomstring.generate();
    await writeMemo(page, content);
    await review(page);
    await expect(page.getByText(content)).toBeVisible();
  });
});
