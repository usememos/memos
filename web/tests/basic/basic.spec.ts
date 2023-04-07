// import { test } from "@playwright/test";
// // import locale from "../../src/locales/en.json";
// // import { baseHost } from "../env";
// import { SignIn, writeMemo } from "../action";

// // let page: Page;
// // test.describe.configure({ mode: "serial" });

// // console.log(data);
// test.use({
//   locale: "en-US",
//   timezoneId: "Europe/Berlin",
// });

// // test.beforeAll(async ({ browser }) => {
// //   page = await browser.newPage();
// // });

// // test.afterAll(async () => {
// //   await page.close();
// // });

// test.describe("Basic Operator", async () => {
//   test("Sign In and write first Memos", async ({ page }) => {
//     await SignIn(page, "admin", "admin");
//     await writeMemo(page, "Hello World");
//   });
// });

// // test.describe("Login", () => {
// //   test("has title", async ({ page }) => {
// //     await page.goto(`${baseHost}/`);
// //     await expect(page).toHaveTitle(/memos/);
// //   });

// //   test("login", async () => {
// //     await page.goto(`${baseHost}/`);

// //     // Click the get started link.
// //     await page.getByRole("link", { name: locale.common["sign-in"] }).click();

// //     // Expects the URL to contain intro.
// //     await expect(page).toHaveURL(/.*auth/);
// //     await page.getByRole("button", { name: locale.common["sign-in"] }).click();

// //     await expect(page.getByText(locale.common.home)).toBeVisible();
// //   });
// // });

// // test.describe("Home", () => {
// //   test("Write Memos", async () => {
// //     await page.goto(`${baseHost}/`);
// //     const RandomString = Math.random().toString(36).substring(7);
// //     writeMemo(page, RandomString);

// //     await expect(page.getByText(RandomString)).toBeVisible();
// //   });

// //   test("Filter Memos", async () => {
// //     await page.goto(`${baseHost}/`);
// //   });
// // });
