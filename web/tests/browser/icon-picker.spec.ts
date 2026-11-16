import { expect, type Locator, test } from "@playwright/test";
import type {} from "./icon-picker";

const geometry = (popup: Locator) =>
  popup.evaluate((element) => ({
    popup: element.getBoundingClientRect().toJSON(),
    tabs: element.querySelector('[role="tablist"]')!.getBoundingClientRect().toJSON(),
    search: element.querySelector('[role="combobox"]')!.getBoundingClientRect().toJSON(),
  }));

for (const [locale, label] of [
  ["en", "Use default icon"],
  ["zh-Hans", "使用默认图标"],
  ["de", "Standardsymbol verwenden"],
]) {
  for (const theme of ["light", "dark"]) {
    test(`${locale} ${theme}: the default action and tabs keep the picker stable`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/tests/browser/icon-picker.html");
      await page.waitForFunction(() => window.iconPickerTest !== undefined);
      await page.evaluate(
        async ({ locale, theme }) => {
          await window.iconPickerTest.setLocale(locale);
          document.documentElement.dataset.theme = theme;
        },
        { locale, theme },
      );

      const trigger = page.locator(".mu-popover-trigger");
      await trigger.click();
      const popup = page.locator(".mu-popover-popup");
      const action = popup.getByRole("button", { name: label, exact: true });
      await expect(popup.getByRole("combobox")).toBeFocused();
      await expect(action).toHaveCount(0);
      const initial = await geometry(popup);

      await popup.getByRole("tab").nth(1).click();
      await expect.poll(() => geometry(popup)).toEqual(initial);
      await page.evaluate(() => window.iconPickerTest.setCustom(true));
      await expect(action).toBeVisible();
      await expect.poll(() => geometry(popup)).toEqual(initial);
      const actionBox = (await action.boundingBox())!;
      expect(actionBox.x).toBeGreaterThanOrEqual(initial.tabs.right);
      expect(actionBox.y).toBeGreaterThanOrEqual(initial.tabs.top);
      expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(initial.tabs.bottom);

      await page.evaluate(() => window.iconPickerTest.setCustom(false));
      await expect(action).toHaveCount(0);
      await expect.poll(() => geometry(popup)).toEqual(initial);
      await page.evaluate(() => window.iconPickerTest.setCustom(true));
      await expect(action).toBeVisible();
      await popup.getByRole("tab").first().click();
      await expect.poll(() => geometry(popup)).toEqual(initial);
      await popup.getByRole("combobox").fill("no-matching-icon");
      await expect(popup.getByRole("gridcell")).toHaveCount(0);
      await expect.poll(() => geometry(popup)).toEqual(initial);
      await popup.screenshot({ path: testInfo.outputPath("default-action.png") });

      await popup.getByRole("combobox").press("Shift+Tab");
      await expect(action).toBeFocused();
      await action.press("Enter");
      await expect(popup).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => window.iconPickerTest.changes)).toEqual([null]);
      await expect(trigger.locator(".lucide-astroid")).toBeVisible();

      await trigger.click();
      await expect(popup.getByRole("combobox")).toBeFocused();
      await expect(action).toHaveCount(0);
      await expect.poll(() => geometry(popup)).toEqual(initial);
      expect(errors).toEqual([]);
    });
  }
}
