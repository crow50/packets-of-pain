import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['eslint.config.js'],
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      // This repo is currently "no-build" and uses classic browser globals.
      // Treat files as scripts (not ES modules) to avoid false positives.
      sourceType: 'script',
      globals: {
        ...globals.browser,
        THREE: 'readonly',

        // Legacy globals used across game.js + src/ (until we modularize)
        STATE: 'readonly',
        CONFIG: 'readonly',
        TRAFFIC_TYPES: 'readonly',
        SoundService: 'readonly',
        serviceGroup: 'readonly',
        requestGroup: 'readonly',
        flashMoney: 'readonly',
        updateScore: 'readonly',
        calculateFailChanceBasedOnLoad: 'readonly',
        finishRequest: 'readonly',
        failRequest: 'readonly',
        Service: 'readonly',
        Request: 'readonly'
      }
    },
    rules: {
      // Keep it lightweight for a no-build browser game.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // We'll turn these back on once we modularize and remove global coupling.
      'no-undef': 'off',
      'no-redeclare': 'off'
    }
  }
];
