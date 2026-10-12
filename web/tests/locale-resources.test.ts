import { type NodePath, parseSync, traverse } from "@babel/core";
import { describe, expect, it } from "vitest";
import english from "../src/locales/en.json";

interface Messages {
  [key: string]: string | Messages;
}

const flatten = (messages: Messages, prefix = ""): Record<string, string> =>
  Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string" ? [[path, value]] : Object.entries(flatten(value, path));
    }),
  );

const placeholders = (value: string) =>
  [...value.matchAll(/\{\{[^{}]+\}\}|\{(?:timestamp|uuid|filename)\}/g)].map(([match]) => match).sort();
const source = flatten(english);
const locales = import.meta.glob<{ default: Messages }>("../src/locales/*.json", { eager: true });
const sourceFiles = import.meta.glob<string>(
  ["../src/**/*.{ts,tsx}", "!../src/types/proto/**", "!../src/**/*.d.ts", "!../src/**/*.test.{ts,tsx}"],
  { eager: true, query: "?raw", import: "default" },
);

const pluralSuffix = /_(zero|one|two|few|many|other)$/;
const pluralBase = (key: string) => key.replace(pluralSuffix, "");
const referenceFor = (key: string) => source[key] ?? (pluralSuffix.test(key) ? source[`${pluralBase(key)}_other`] : undefined);

// These are the finite values used by computed translation keys. Apply them only
// when the matching t() call exists; never exempt an entire namespace from checks.
const dynamicKeyParts: Record<string, readonly string[]> = {
  "attachment-library.tabs.${}": ["audio", "documents", "media"],
  "live-update.${}": ["connected", "connecting", "disconnected"],
  "memo.${}": ["layout-auto", "layout-columns", "layout-list"],
  "memo.${}-description": ["layout-auto", "layout-columns", "layout-list"],
  "setting.notification.requirement-${}": ["gmail", "optional", "recommended", "required"],
  "space.icon.${}": ["emoji", "icons"],
};

const collectReferences = (files: Record<string, string>) => {
  const keys = new Set<string>();
  const dynamicPatterns = new Set<string>();
  const unreviewedPatterns: string[] = [];

  for (const [filename, code] of Object.entries(files)) {
    const ast = parseSync(code, {
      filename,
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ["typescript", "jsx"] },
    });
    if (!ast) throw new Error(`Could not parse ${filename}`);

    traverse(ast, {
      StringLiteral(path) {
        // Include configuration objects and validation results passed to t(key),
        // but do not let comments or TypeScript declarations keep dead copy alive.
        if (!path.findParent((parent) => parent.isTSType())) keys.add(path.node.value);
      },
      TemplateLiteral(path) {
        if (path.findParent((parent) => parent.isTSType())) return;
        if (path.node.expressions.length === 0) {
          keys.add(path.node.quasis[0].value.cooked ?? path.node.quasis[0].value.raw);
          return;
        }

        // Include templates inside assertions or conditional arguments to t().
        let argument: NodePath = path;
        while (argument.parentPath && !argument.parentPath.isCallExpression()) {
          argument = argument.parentPath;
        }
        const call = argument.parentPath;
        if (!call?.isCallExpression() || call.node.arguments[0] !== argument.node) return;
        const callee = call.node.callee;
        const isTranslation =
          (callee.type === "Identifier" && callee.name === "t") ||
          (callee.type === "MemberExpression" && callee.property.type === "Identifier" && callee.property.name === "t");
        if (!isTranslation) return;

        const pattern = path.node.quasis.map((part) => part.value.cooked ?? part.value.raw).join("${}");
        const parts = dynamicKeyParts[pattern];
        if (!parts) {
          unreviewedPatterns.push(`${filename}:${path.node.loc?.start.line}: ${pattern}`);
          return;
        }
        dynamicPatterns.add(pattern);
        for (const part of parts) keys.add(pattern.replace("${}", part));
      },
    });
  }

  return { keys, dynamicPatterns, unreviewedPatterns };
};

describe("locale key usage", () => {
  it("references every English key and reviews every computed key pattern", () => {
    const references = collectReferences(sourceFiles);

    expect(references.unreviewedPatterns, "Add finite values for new computed translation keys").toEqual([]);
    expect([...references.dynamicPatterns].sort(), "Remove stale computed-key rules").toEqual(Object.keys(dynamicKeyParts).sort());
    expect(Object.keys(source).filter((key) => !references.keys.has(key) && !references.keys.has(pluralBase(key)))).toEqual([]);
  });

  it("counts runtime key definitions but ignores comments and type-only references", () => {
    const references = collectReferences({
      "fixture.ts": `
        // t("comment.only")
        type Key = "type.only";
        const option = { labelKey: "runtime.option" };
        t(option.labelKey);
        t(condition ? "runtime.first" : "runtime.second");
        t(\`runtime.template\`);
      `,
    });

    expect([...references.keys].sort()).toEqual(["runtime.first", "runtime.option", "runtime.second", "runtime.template"]);
  });

  it("expands only computed translation calls that are present", () => {
    const references = collectReferences({
      "fixture.ts": `
        t(\`memo.\${key}\`);
        i18n.t(\`live-update.\${status}\` as Translations);
        const unrelated = \`space.icon.\${name}\`;
      `,
    });

    expect([...references.keys].sort()).toEqual([
      "live-update.connected",
      "live-update.connecting",
      "live-update.disconnected",
      "memo.layout-auto",
      "memo.layout-columns",
      "memo.layout-list",
    ]);
    expect(collectReferences({ "empty.ts": "" }).keys.size).toBe(0);
  });

  it("flags unreviewed computed keys instead of allowing a whole namespace", () => {
    const references = collectReferences({ "fixture.ts": "t(`memo.${kind}.${state}`);" });

    expect(references.keys.size).toBe(0);
    expect(references.unreviewedPatterns).toEqual(["fixture.ts:1: memo.${}.${}"]);
  });
});

describe("locale resources", () => {
  it("allows extra plural categories only for existing plural messages", () => {
    expect(referenceFor("setting.sso.scope-count_few")).toBe(source["setting.sso.scope-count_other"]);
    expect(referenceFor("setting.sso.scope-count_many")).toBe(source["setting.sso.scope-count_other"]);
    expect(referenceFor("setting.sso.removed-key_other")).toBeUndefined();
    expect(referenceFor("common.save_few")).toBeUndefined();
  });

  for (const [path, module] of Object.entries(locales)) {
    it(`includes every English message and preserves placeholders in ${path}`, () => {
      const messages = flatten(module.default);

      expect(Object.keys(source).filter((key) => !(key in messages))).toEqual([]);
      // Extra plural categories are valid; other keys must exist in the source.
      expect(Object.keys(messages).filter((key) => referenceFor(key) === undefined)).toEqual([]);
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), key).not.toBe("");
        const reference = referenceFor(key);
        if (reference !== undefined) {
          expect(placeholders(value), key).toEqual(placeholders(reference));
        }
      }
    });

    it(`preserves literal input values in ${path}`, () => {
      const messages = flatten(module.default);

      expect(messages["setting.storage.filepath-template-description"]).toContain("assets/{timestamp}_{uuid}_{filename}");
      expect(messages["setting.memo-export.import-detail"]).toMatch(/zip/i);
      for (const key of ["transcription-model-placeholder-openai", "transcription-model-placeholder-gemini"]) {
        expect(messages[`setting.ai.${key}`]).toBe(source[`setting.ai.${key}`]);
      }
      for (const model of ["whisper-1", "gpt-4o-transcribe", "whisper-large-v3-turbo"]) {
        expect(messages["setting.ai.transcription-model-help"]).toContain(model);
      }
    });
  }
});
