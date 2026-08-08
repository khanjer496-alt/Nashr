/**
 * Nashr (نشر) — Jest globalSetup for the integration suite.
 *
 * Drops and recreates the test database, then applies the REAL migration
 * history with `prisma migrate deploy`. Two things fall out of that:
 *
 *   - every integration run is also a migration smoke test (RISK-01);
 *   - the schema under test is the schema production will get, not whatever
 *     `db push` happens to produce.
 */
import { execFileSync } from 'child_process';
import * as path from 'path';
import {
  TEST_DB_NAME,
  TEST_PG_HOST,
  TEST_PG_PORT,
  TEST_PG_USER,
  testDatabaseUrl,
} from './db';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA = path.join(
  REPO_ROOT,
  'libraries/nestjs-libraries/src/database/prisma/schema.prisma'
);
const PRISMA_BIN = path.join(REPO_ROOT, 'node_modules/.bin/prisma');

const PG_ENV = {
  ...process.env,
  PGHOST: TEST_PG_HOST,
  PGPORT: TEST_PG_PORT,
  PGUSER: TEST_PG_USER,
};

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = PG_ENV) {
  return execFileSync(cmd, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

export default async function globalSetup() {
  if (process.env.NASHR_TEST_SKIP_MIGRATE === '1') {
    process.env.DATABASE_URL = testDatabaseUrl();
    return;
  }

  // Fail loudly and early if there is no server — a silent fallback to an
  // in-memory anything would make this whole suite meaningless.
  try {
    run('psql', ['-d', 'postgres', '-tAc', 'select 1']);
  } catch (err: any) {
    throw new Error(
      `Cannot reach PostgreSQL at host=${TEST_PG_HOST} port=${TEST_PG_PORT} ` +
        `user=${TEST_PG_USER}. The Nashr integration suite requires a real ` +
        `database; it does not mock Prisma.\n${err?.stderr || err?.message}`
    );
  }

  run('dropdb', ['--if-exists', TEST_DB_NAME]);
  run('createdb', [TEST_DB_NAME]);

  run(PRISMA_BIN, ['migrate', 'deploy', '--schema', SCHEMA], {
    ...PG_ENV,
    DATABASE_URL: testDatabaseUrl(),
  });

  process.env.DATABASE_URL = testDatabaseUrl();
}
