import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        'prefer': 'type-imports',
        'fixStyle': 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-assertions': ['error', {
        'assertionStyle': 'as',
        'objectLiteralTypeAssertions': 'never',
      }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
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
        },
        {
          "selector": "UnaryExpression[operator='!'] > MemberExpression[object.type='ThisExpression'][property.name=/^(startedAt|lastTriggeredAt|lastFinishedAt|firstSuccessAt|startTime|lastNow)$/]",
          "message": "Use === undefined instead of falsy check on sentinel timing fields. Falsy checks treat 0 as unset."
        }
      ]
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
)
