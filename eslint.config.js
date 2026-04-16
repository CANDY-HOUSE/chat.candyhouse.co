const reactPlugin = require('eslint-plugin-react')
const hooksPlugin = require('eslint-plugin-react-hooks')
const typescriptPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')

module.exports = [
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      // React 规则
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks: '(useMyCustomHook|useMyOtherHook)'
        }
      ],

      // TypeScript 规则
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],

      // 通用规则
      'no-unused-vars': 'off',
      'no-console': 'warn',

      // 导入规则
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@mui/*/*/*']
        }
      ]
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // 添加测试文件的特殊配置
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
]
