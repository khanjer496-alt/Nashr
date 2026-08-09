/**
 * Compile-time assertion that the local `NashrRoleName` union in role.matrix.ts
 * stays identical to `enum NashrRole` in schema.prisma.
 *
 * If someone adds a role to the schema and forgets the matrix (or vice versa)
 * this file stops compiling. It emits no runtime code — types only.
 *
 * Requires `prisma generate` to have run (root `postinstall` does this).
 */
import type { NashrRole } from '@prisma/client';
import type { NashrRoleName } from './role.matrix';

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _rolesAreInSync: Exact<NashrRoleName, `${NashrRole}`> = true;

export {};
