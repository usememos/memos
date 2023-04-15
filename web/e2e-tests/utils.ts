import { expect, Page } from "@playwright/test";
import locale from "../src/locales/en.json";
import { baseHost } from "./fixtures";

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `playwright-screenshot/${name}.png`, fullPage: true });
}

async function writeMemo(page: Page, content: string) {
  await expect(page.getByRole("button", { name: locale.editor.save })).toBeDisabled();
  await page.getByPlaceholder("Any thoughts...").fill(content);
  await expect(page.getByRole("button", { name: locale.editor.save })).toBeEnabled();
  await page.getByRole("button", { name: locale.editor.save }).click();
}

async function login(page: Page, username: string, password: string) {
  page.goto(`${baseHost}/`);
  await screenshot(page, "explore-page");
  await page.waitForURL("**/explore");
  await screenshot(page, "explore-page-after-wait");
  await page.getByRole("link", { name: locale.common["sign-in"] }).click();
  await screenshot(page, "auth-page");
  await page.waitForURL("**/auth");
  await page.locator('input[type="text"]').click();
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').click();
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: locale.common["sign-in"] }).click();
  await page.waitForTimeout(1000);
  await screenshot(page, "home-page-login-success");
}

async function signUp(page: Page, username: string, password: string) {
  await page.goto(`${baseHost}/`);
  await page.waitForURL("**/auth");
  await screenshot(page, "sign-up-page");
  await page.locator('input[type="text"]').click();
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').click();
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: locale.auth["signup-as-host"] }).click();
  await page.waitForTimeout(1000);
  await screenshot(page, "home-page-sign-up-success");
}

async function review(page: Page) {
  await page.goto(`${baseHost}/`);
  await page.getByRole("link", { name: locale["daily-review"]["title"] }).click();
  await screenshot(page, "review");
}

export { writeMemo, login, signUp, review };
