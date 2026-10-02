import { describe, expect, it } from "vitest";
import { isOverlayOpen, isTypingTarget } from "@/lib/keyboard-shortcuts";

describe("isTypingTarget", () => {
  it("detects inputs, contenteditable, and CodeMirror", () => {
    document.body.innerHTML = `
      <input id="input" />
      <textarea id="textarea"></textarea>
      <div contenteditable="true"><span id="editable">x</span></div>
      <div class="cm-editor"><div id="cm"></div></div>
      <article id="card" tabindex="0"></article>
    `;
    for (const id of ["input", "textarea", "editable", "cm"]) {
      expect(isTypingTarget(document.getElementById(id)), id).toBe(true);
    }
    expect(isTypingTarget(document.getElementById("card"))).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
  });
});

describe("isOverlayOpen", () => {
  it("only counts open dialogs and menus", () => {
    document.body.innerHTML = `<div role="dialog" data-closed></div>`;
    expect(isOverlayOpen()).toBe(false);
    document.body.innerHTML = `<div role="menu" data-open></div>`;
    expect(isOverlayOpen()).toBe(true);
    document.body.innerHTML = "";
  });
});
