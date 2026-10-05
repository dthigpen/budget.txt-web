import js from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: pluginReact,
    },
    settings: {
      react: {
        pragma: "h",
        version: "18.0",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
];
