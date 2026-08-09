/**
 * Nashr (نشر) — self-contained Jest config for libraries/nashr-i18n.
 *
 * The repo-root jest.config.ts calls `getJestProjects()` from '@nx/jest',
 * which is not installed and has no nx.json, so the root runner is broken
 * upstream for every project. Run this directly:
 *
 *   npx jest -c libraries/nashr-i18n/jest.config.js
 */
const path = require('path');
const root = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: root,
  displayName: 'nashr-i18n',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.spec.json') },
    ],
  },
  testMatch: ['<rootDir>/libraries/nashr-i18n/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@gitroom/nashr-i18n/(.*)$': '<rootDir>/libraries/nashr-i18n/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
