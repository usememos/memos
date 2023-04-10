import { expect, Page } from "@playwright/test";
import locale from "../src/locales/en.json";
import { baseHost } from "./fixtures";

async function writeMemo(page: Page, content: string) {
  await expect(page.getByRole("button", { name: locale.editor.save })).toBeDisabled();
  await page.getByPlaceholder("Any thoughts...").fill(content);
  await expect(page.getByRole("button", { name: locale.editor.save })).toBeEnabled();
  await page.getByRole("button", { name: locale.editor.save }).click();
}

async function login(page: Page, username: string, password: string) {
  page.goto(`${baseHost}/`);
  await page.screenshot({ path: "../playwright-report/screenshot/main.png", fullPage: true });
  await page.getByRole("link", { name: locale.common["sign-in"] }).click();
  await page.screenshot({ path: "../playwright-report/screenshot/login.png", fullPage: true });
  await expect(page).toHaveURL(/.*auth/);
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: locale.common["sign-in"] }).click();
  await expect(page.getByText(locale.common.home)).toBeVisible();
}

async function SignUp(page: Page, username: string, password: string) {
  await page.goto(`${baseHost}/`);
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: locale.auth["signup-as-host"] }).click();
}

async function Review(page: Page) {
  await page.goto(`${baseHost}/`);
  await page.getByRole("link", { name: locale["daily-review"]["title"] }).click();
}

export { writeMemo, login, SignUp, Review };
