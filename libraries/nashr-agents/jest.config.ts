/**
 * Standalone Jest config for libraries/nashr-agents.
 *
 * The root `jest.config.ts` uses `getJestProjects()` from `@nx/jest`, but the
 * repository has no `nx.json` and `@nx/jest` is not installed, so the root
 * runner does not work upstream either. Run this project directly:
 *
 *   npx jest --config libraries/nashr-agents/jest.config.ts
 */
import type { Config } from 'jest';

const config: Config = {
  displayName: 'nashr-agents',
  preset: undefined,
  testEnvironment: 'node',
  rootDir: '../../',
  roots: ['<rootDir>/libraries/nashr-agents'],
  testMatch: ['<rootDir>/libraries/nashr-agents/src/**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/libraries/nashr-agents/tsconfig.spec.json' },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverageFrom: [
    '<rootDir>/libraries/nashr-agents/src/**/*.ts',
    '!<rootDir>/libraries/nashr-agents/src/**/*.spec.ts',
    '!<rootDir>/libraries/nashr-agents/src/__tests__/**',
    // Excluded from coverage: these only exist to bind to Nest/Mastra/Prisma
    // and are covered by the backend build plus manual verification.
    '!<rootDir>/libraries/nashr-agents/src/nashr-agents.service.ts',
    '!<rootDir>/libraries/nashr-agents/src/mastra.binding.ts',
    '!<rootDir>/libraries/nashr-agents/src/adapters/**',
  ],
};

export default config;
