import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.config(eslint.configs.recommended, tseslint.configs.recommended),
  eslintPluginPrettierRecommended,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/proto/**"],
  },
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": ["off"],
      "react/react-in-jsx-scope": "off",
      "react/jsx-no-target-blank": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "VariableDeclarator[init.callee.name='useTranslation'] > ObjectPattern > Property[key.name='t']:not([parent.declarations.0.init.callee.object.name='i18n'])",
          message: "Destructuring 't' from useTranslation is not allowed. Please use the 'useTranslate' hook from '@/utils/i18n'.",
        },
      ],
    },
  },
  {
    files: ["src/utils/i18n.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
