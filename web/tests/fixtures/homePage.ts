import { expect, Page } from "@playwright/test";
import { baseHost } from "../env";
import locale from "../../src/locales/en.json";
import { writeMemo } from "../action";

export class HomePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.page.goto(`${baseHost}`);
  }
  async writeMemo(memo: string) {
    writeMemo(this.page, memo);
  }
  async getByText(text: string) {
    return this.page.getByText(text);
  }
  async locator(selector: string) {
    return this.page.locator(selector);
  }
}
