import { expect, test } from "@playwright/test";
import type { TextElement } from "@usememos/canvas";
import type {} from "./drawing";

test("uses the live zoom percentage as the same menu trigger in view and edit", async ({ page }, testInfo) => {
  await page.goto("/tests/browser/drawing.html");
  await page.getByRole("button", { name: "View markup", exact: true }).click();
  const zoom = page.getByRole("button", { name: /^Zoom \d+%$/ });
  await expect(zoom).toHaveText("100%");
  const position = await zoom.boundingBox();
  const choose = async (name: string) => {
    await zoom.click();
    await page.getByRole("menuitem", { name, exact: true }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };
  if (testInfo.project.name === "phone") {
    const surface = await page.getByRole("application").boundingBox();
    if (!surface) throw new Error("Missing drawing surface");
    const cdp = await page.context().newCDPSession(page);
    const x = surface.x + surface.width / 2;
    const y = surface.y + surface.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 20, y, id: 1 },
        { x: x + 20, y, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 40, y, id: 1 },
        { x: x + 40, y, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(zoom).toHaveText("200%");
    await choose("Reset zoom");
    await expect(zoom).toHaveText("100%");
  }
  for (const mode of ["view", "edit"]) {
    if (mode === "edit") await page.getByRole("button", { name: "Edit", exact: true }).click();
    expect(await zoom.boundingBox()).toEqual(position);
    await choose("Zoom in");
    await expect(zoom).toHaveText("120%");
    await choose("Zoom out");
    await expect(zoom).toHaveText("100%");
    await choose("Zoom out");
    await expect(zoom).toHaveText("83%");
    await choose("Zoom to fit");
    await expect(zoom).toHaveText("100%");
    await choose("Zoom in");
    await choose("Reset zoom");
    await expect(zoom).toHaveText("100%");
    const surface = await page.getByRole("application").boundingBox();
    if (!surface) throw new Error("Missing drawing surface");
    await zoom.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.click(surface.x + surface.width / 2, surface.y + surface.height / 2);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await zoom.focus();
    await zoom.press("ArrowDown");
    await expect(page.getByRole("menuitem")).toHaveCount(4);
    const menu = await page.getByRole("menu").boundingBox();
    if (!menu || !position) throw new Error("Missing zoom menu");
    expect(menu.y + menu.height).toBeLessThanOrEqual(position.y);
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(page.getByRole("menuitem", { name: "Zoom to fit", exact: true }).locator("svg")).toHaveClass(/lucide-scan-search/);
    await page.screenshot({ path: testInfo.outputPath(`zoom-menu-${mode}.png`), animations: "disabled" });
    if (testInfo.project.name === "phone") {
      const viewport = page.viewportSize()!;
      const y = Math.max(0, Math.floor(menu.y) - 12);
      await page.screenshot({
        path: testInfo.outputPath(`zoom-menu-detail-${mode}.png`),
        animations: "disabled",
        clip: { x: 0, y, width: viewport.width, height: viewport.height - y },
      });
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(zoom).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
});

test("opens an existing drawing directly from the composer", async ({ page }) => {
  await page.goto("/tests/browser/drawing.html");
  await page.getByRole("button", { name: "Edit saved markup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page
        .getByRole("application")
        .locator("canvas")
        .first()
        .evaluate((canvas: HTMLCanvasElement) => {
          const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
          let dark = 0;
          for (let i = 0; i < data.length; i += 4) if (data[i + 3] && data[i] + data[i + 1] + data[i + 2] < 300) dark++;
          return dark;
        }),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("keeps the drawing, viewport and focus when switching between view and edit", async ({ page }, testInfo) => {
  await page.goto("/tests/browser/drawing.html");
  await page.getByRole("button", { name: "View markup", exact: true }).click();
  const edit = page.getByRole("button", { name: "Edit", exact: true });
  await expect(edit).toBeEnabled();
  const surface = page.getByRole("application");
  const original = await surface.elementHandle();
  const pixels = () =>
    surface
      .locator("canvas")
      .first()
      .evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        let position = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] && data[i] + data[i + 1] + data[i + 2] < 300) {
            count++;
            position += i;
          }
        }
        return { count, position };
      });
  await expect.poll(async () => (await pixels()).count).toBeGreaterThan(0);
  const fitted = await pixels();
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error("Missing drawing surface");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(12, 20);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -20);
  await page.keyboard.up("Control");
  await expect.poll(pixels).not.toEqual(fitted);
  const before = await pixels();
  const closePosition = await page.getByRole("button", { name: "Close", exact: true }).boundingBox();
  const zoom = page.getByRole("button", { name: /^Zoom \d+%$/ });
  await expect(zoom).toHaveText("122%");
  await expect(zoom).toHaveClass(/mu-button-ghost/);
  await expect(zoom).toHaveAttribute("aria-haspopup", "menu");
  const fit = async () => {
    await zoom.click();
    await page.getByRole("menuitem", { name: "Zoom to fit", exact: true }).click();
  };
  const zoomPosition = await zoom.boundingBox();
  if (!zoomPosition) throw new Error("Missing zoom control");
  expect(zoomPosition.x - bounds.x).toBeGreaterThanOrEqual(8);
  expect(zoomPosition.x - bounds.x).toBeLessThan(24);
  const bottomGap = bounds.y + bounds.height - zoomPosition.y - zoomPosition.height;
  expect(bottomGap).toBeGreaterThanOrEqual(testInfo.project.name === "phone" ? 60 : 8);
  expect(bottomGap).toBeLessThan(testInfo.project.name === "phone" ? 80 : 24);
  await page.screenshot({ path: testInfo.outputPath("markup-view.png") });
  for (let i = 0; i < 2; i++) {
    await edit.click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await expect.poll(pixels).toEqual(before);
    expect(await surface.evaluate((node, previous) => node === previous, original)).toBe(true);
    await expect(surface).toBeFocused();
    expect(await page.getByRole("button", { name: "Close", exact: true }).boundingBox()).toEqual(closePosition);
    expect(await zoom.boundingBox()).toEqual(zoomPosition);
    if (testInfo.project.name === "phone") {
      const tools = await page.getByRole("group", { name: "Tools", exact: true }).boundingBox();
      if (!tools) throw new Error("Missing tools");
      expect(tools.y - zoomPosition.y - zoomPosition.height).toBeGreaterThanOrEqual(8);
    }
    if (i === 0) await page.screenshot({ path: testInfo.outputPath("markup-edit.png") });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(edit).toBeFocused();
    await expect.poll(pixels).toEqual(before);
    await expect(page.getByRole("group", { name: "Tools", exact: true })).toHaveCount(0);
  }
  await fit();
  await expect.poll(pixels).toEqual(fitted);
  await edit.click();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(12, 20);
  await expect.poll(pixels).not.toEqual(fitted);
  await fit();
  await expect.poll(pixels).toEqual(fitted);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.7, { steps: 5 });
  await page.mouse.up();
  await expect.poll(pixels).not.toEqual(fitted);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Keep drawing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(edit).toBeFocused();
  await expect.poll(pixels).toEqual(fitted);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("annotates beside the original without draft UI", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/browser/drawing.html");
  await page.getByRole("textbox", { name: "Memo text" }).fill("Memo with markup");
  const original = await page.evaluate(async () =>
    Array.from(new Uint8Array(await window.drawingTest.store.getState().localFiles[0].file.arrayBuffer())),
  );
  await page.getByRole("button", { name: "Annotate source" }).click();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
  const initialZoom = Number.parseInt(await page.getByRole("button", { name: /^Zoom \d+%$/ }).innerText(), 10);
  expect(initialZoom).toBeGreaterThan(0);
  if (testInfo.project.name === "phone") expect(initialZoom).toBeLessThan(100);
  if (testInfo.project.name === "phone") await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
  else await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Arrow", exact: true }).click();
  const bounds = await page.getByRole("application").boundingBox();
  if (!bounds) throw new Error("Missing drawing surface");
  await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.55, { steps: 8 });
  await page.mouse.up();
  if (testInfo.project.name === "phone") {
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await expect(undo).toHaveClass(/mu-button-ghost/);
    expect(await undo.evaluate((button) => button.closest(".border-mu-edge"))).toBeNull();
    const position = await undo.boundingBox();
    expect(position?.x).toBeLessThan(120);
    await undo.click();
    await expect(undo).toHaveCount(0);
    await expect(page.getByRole("application")).toBeFocused();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
  if (testInfo.project.name === "phone") await page.screenshot({ path: testInfo.outputPath("markup-phone.png") });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const { store, readScenePng } = window.drawingTest;
    const state = store.getState();
    const file = state.localFiles.find((item) => item.file.name.endsWith(".canvas.png"));
    if (!file) throw new Error("Missing markup");
    const { scene } = await readScenePng(file.file);
    return {
      text: state.content,
      count: state.localFiles.length,
      elements: scene?.elements.length,
      locked: scene?.elements[0].locked,
      original: Array.from(new Uint8Array(await state.localFiles[0].file.arrayBuffer())),
      order: state.attachmentOrder.map((key) => state.localFiles.find((item) => item.previewUrl === key)?.file.name),
    };
  });
  expect(result).toMatchObject({ text: "Memo with markup", count: 3, elements: 2, locked: true, original });
  expect(result.order).toEqual(["original.png", expect.stringMatching(/\.canvas\.png$/), "other.txt"]);
  await expect(page.getByText("Continue markup", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("includes active Chinese text when adding markup", async ({ page }) => {
  await page.goto("/tests/browser/drawing.html");
  await page.getByRole("button", { name: "Annotate source" }).click();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const bounds = await page.getByRole("application").boundingBox();
  if (!bounds) throw new Error("Missing drawing surface");
  await page.mouse.click(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4);
  const input = page.getByRole("textbox", { name: "Text", exact: true });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "nihao", selectionStart: 5, selectionEnd: 5 });
  await expect(input).toBeFocused();
  await cdp.send("Input.insertText", { text: "你好" });
  await expect(input).toHaveValue("你好");
  const overflow = await page
    .getByRole("dialog")
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.some((button) => {
        const bounds = button.getBoundingClientRect();
        return bounds.width > 0 && (bounds.x < 0 || bounds.right > innerWidth);
      }),
    );
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const file = window.drawingTest.store.getState().localFiles.find((item) => item.file.name.endsWith(".canvas.png"));
      if (!file) throw new Error("Missing markup");
      const { scene } = await window.drawingTest.readScenePng(file.file);
      return (scene?.elements.find((item) => item.type === "text") as TextElement | undefined)?.text;
    }),
  ).toBe("你好");
});
