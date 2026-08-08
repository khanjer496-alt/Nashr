/**
 * Nashr (نشر) — self-contained Jest config for libraries/nashr-approval.
 *
 * The repo-root jest.config.ts calls `getJestProjects()` from '@nx/jest',
 * which is not in package.json, so the root runner does not currently work.
 * This config is standalone and needs only jest + ts-jest:
 *
 *   npx jest -c libraries/nashr-approval/jest.config.js
 */
const path = require('path');
const root = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: root,
  displayName: 'nashr-approval',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.spec.json') },
    ],
  },
  testMatch: ['<rootDir>/libraries/nashr-approval/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@gitroom/nashr-permissions/(.*)$':
      '<rootDir>/libraries/nashr-permissions/src/$1',
    '^@gitroom/nashr-approval/(.*)$':
      '<rootDir>/libraries/nashr-approval/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
