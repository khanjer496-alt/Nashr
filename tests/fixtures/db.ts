/**
 * Nashr (نشر) — real-PostgreSQL test harness.
 *
 * Everything here talks to an actual database. Nothing is mocked, because the
 * defects these tests hunt for (missing `organizationId` in a Prisma `where`)
 * are invisible to a mock.
 *
 * Connection is taken from NASHR_TEST_* env vars, falling back to the local
 * development server. The credentials are deliberately obviously-fake and
 * local-only: a trust-auth `postgres` superuser on a UNIX socket.
 */
import { PrismaClient } from '@prisma/client';

export const TEST_PG_HOST = process.env.NASHR_TEST_PGHOST || '/tmp';
export const TEST_PG_PORT = process.env.NASHR_TEST_PGPORT || '5433';
export const TEST_PG_USER = process.env.NASHR_TEST_PGUSER || 'postgres';
export const TEST_DB_NAME = process.env.NASHR_TEST_DB || 'nashr_test';

export function testDatabaseUrl(dbName: string = TEST_DB_NAME): string {
  return `postgresql://${TEST_PG_USER}@localhost:${TEST_PG_PORT}/${dbName}?host=${encodeURIComponent(
    TEST_PG_HOST
  )}`;
}

let _client: PrismaClient | null = null;

/** One shared client for the whole worker. */
export function prisma(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl() } },
    });
  }
  return _client;
}

export async function disconnect() {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}

/**
 * Minimal stand-in for `PrismaRepository<T>` from
 * libraries/nestjs-libraries/src/database/prisma/prisma.service.ts.
 *
 * That class is literally `{ model: prismaService }`, so handing the real
 * client through this wrapper means the repositories under test run their
 * genuine queries against real Postgres.
 */
export function repo<T = any>(): { model: T } {
  return { model: prisma() as unknown as T };
}
