const path = require('path');
const root = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: root,
  displayName: 'nashr-brand',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.spec.json') },
    ],
  },
  testMatch: ['<rootDir>/libraries/nashr-brand/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
