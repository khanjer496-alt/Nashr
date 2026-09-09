import { resolve } from 'node:path';

/** A public website export only. The stateful app still uses Dockerfile.prod. */
export default {
  output: 'export',
  images: { unoptimized: true },
  turbopack: { root: resolve(import.meta.dirname, '../..') },
  // Fail closed: this entrypoint can never advertise an enabled SaaS signup.
  env: { NEXT_PUBLIC_POSTDELEGATE_PREVIEW: 'true' },
};
