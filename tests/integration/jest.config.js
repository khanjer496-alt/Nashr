/**
 * Nashr (نشر) — Phase 7 integration suite.
 *
 * These tests run against a REAL PostgreSQL database. They are deliberately
 * NOT unit tests: the risk they exist to close (RISK-02, cross-tenant data
 * leakage) lives in Prisma `where` clauses, and a mocked Prisma client would
 * happily "pass" a query that has no organizationId filter at all.
 *
 * The repo-root jest.config.ts calls getJestProjects() from '@nx/jest', which
 * is not installed and has no nx.json — it is broken upstream for every
 * project. This config is self-contained, matching the pattern already used by
 * libraries/nashr-*.
 *
 *   npx jest -c tests/integration/jest.config.js --runInBand
 *
 * Requires a running PostgreSQL. Point it at one with:
 *   NASHR_TEST_PGHOST=/tmp NASHR_TEST_PGPORT=5433 NASHR_TEST_PGUSER=postgres
 * The suite creates and migrates its own database (default `nashr_test`) and
 * never touches the development database.
 */
const path = require('path');
const root = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: root,
  displayName: 'nashr-integration',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: path.join(__dirname, 'tsconfig.spec.json'),
      },
    ],
  },
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
  moduleNameMapper: {
    '^@gitroom/nashr-permissions$':
      '<rootDir>/libraries/nashr-permissions/src/index.ts',
    '^@gitroom/nashr-permissions/(.*)$':
      '<rootDir>/libraries/nashr-permissions/src/$1',
    '^@gitroom/nashr-approval$':
      '<rootDir>/libraries/nashr-approval/src/index.ts',
    '^@gitroom/nashr-approval/(.*)$':
      '<rootDir>/libraries/nashr-approval/src/$1',
    '^@gitroom/nashr-agents$': '<rootDir>/libraries/nashr-agents/src/index.ts',
    '^@gitroom/nashr-agents/(.*)$':
      '<rootDir>/libraries/nashr-agents/src/$1',
    '^@gitroom/nashr-i18n$': '<rootDir>/libraries/nashr-i18n/src/index.ts',
    '^@gitroom/nashr-i18n/(.*)$': '<rootDir>/libraries/nashr-i18n/src/$1',
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/orchestrator/(.*)$': '<rootDir>/apps/orchestrator/src/$1',
    '^@gitroom/nashr-brand$': '<rootDir>/libraries/nashr-brand/src/index.ts',
    '^@gitroom/nashr-brand/(.*)$': '<rootDir>/libraries/nashr-brand/src/$1',
    '^@gitroom/react/(.*)$': '<rootDir>/libraries/react-shared-libraries/src/$1',
    '^@gitroom/nashr-content$': '<rootDir>/libraries/nashr-content/src/index.ts',
    '^@gitroom/nashr-content/(.*)$': '<rootDir>/libraries/nashr-content/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  globalSetup: '<rootDir>/tests/fixtures/global.setup.ts',
  // The suites share one Postgres database and assert on absolute row counts
  // in a few places, so they must not interleave.
  maxWorkers: 1,
  testTimeout: 60000,
};
