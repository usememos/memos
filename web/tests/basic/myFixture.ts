import { Page, test as base } from "@playwright/test";
// import { test as base } from "@playwright/test";

type MyFixtures = {
  page: Page;
};

export const mytest = base.extend<MyFixtures>({
  page: async ({ page }, use) => {
    await use(page);
  },
});
