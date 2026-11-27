import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark", "paper"]) {
  test(`${theme}: source mode stays transparent and rich code keeps its background`, async ({ page }, testInfo) => {
    await page.goto("/tests/browser/editor-style.html");
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);

    for (const id of ["empty-source", "filled-source"]) {
      await expect(page.locator(`#${id} > .mbe-source`)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }

    const code = page.locator("#rich-code > .mbe-block");
    await expect(code).toBeVisible();
    const expected = await code.evaluate(() => {
      const sample = document.createElement("div");
      sample.style.backgroundColor = "var(--mu-well)";
      document.body.append(sample);
      const color = getComputedStyle(sample).backgroundColor;
      sample.remove();
      return color;
    });
    expect(expected).not.toBe("rgba(0, 0, 0, 0)");
    await expect(code).toHaveCSS("background-color", expected);
    await page.locator("main").screenshot({ path: testInfo.outputPath(`${theme}.png`) });
  });
}
