import { test, expect, Page } from "@playwright/test";

let page: Page;
test.describe.configure({ mode: "serial" });

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
  await page.getByRole("link", { name: "Sign in" }).click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*auth/);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Home")).toBeVisible();
});

test("Write Memos", async () => {
  await page.goto("http://localhost:3001/");
  const RandomString = Math.random().toString(36).substring(7);
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByPlaceholder("Any thoughts...").fill(RandomString);
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(RandomString)).toBeVisible();
});

test("Filter Memos", async () => {
  await page.goto("http://localhost:3001/");
});
