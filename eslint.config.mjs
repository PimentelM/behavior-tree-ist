import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-this-alias': 'off',
      // Disable the base ESLint rule as it can report incorrect errors for TS
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],
      "no-restricted-syntax": [
        "error",
        {
          "selector": "TSImportType",
          "message": "Dynamic type imports are forbidden. Use a regular import instead."
        }
      ]
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
)
