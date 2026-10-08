const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', 'prototype/*', 'server/*', '.expo/*', 'tests/*'],
  },
  {
    rules: {
      // In React Native i testi non sono HTML: virgolette e apostrofi nel JSX sono innocui.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
