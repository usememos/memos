import { test, expect, Page } from "@playwright/test";
import locale from "../src/locales/en.json";

let page: Page;
test.describe.configure({ mode: "serial" });

// console.log(data);
test.use({
  locale: "en-US",
  timezoneId: "Europe/Berlin",
});

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test("has title", async ({ page }) => {
  await page.goto("http://localhost:3001/");
  await expect(page).toHaveTitle(/memos/);
});

test("login", async () => {
  await page.goto("http://localhost:3001/");

  // Click the get started link.
  await page.getByRole("link", { name: locale.common["sign-in"] }).click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*auth/);
  await page.getByRole("button", { name: locale.common["sign-in"] }).click();

  await expect(page.getByText(locale.common.home)).toBeVisible();
});

test("Write Memos", async () => {
  await page.goto("http://localhost:3001/");
  const RandomString = Math.random().toString(36).substring(7);
  await expect(page.getByRole("button", { name: locale.editor.save })).toBeDisabled();
  await page.getByPlaceholder("Any thoughts...").fill(RandomString);
  await expect(page.getByRole("button", { name: locale.editor.save })).toBeEnabled();
  await page.getByRole("button", { name: locale.editor.save }).click();
  await expect(page.getByText(RandomString)).toBeVisible();
});

test("Filter Memos", async () => {
  await page.goto("http://localhost:3001/");
});
