const { join } = require('node:path');
const shared = require('../frontend/tailwind.config.cjs');
module.exports = {
  ...shared,
  content: [
    join(__dirname, 'app/**/*.{ts,tsx}'),
    join(__dirname, '../frontend/src/components/{marketing,layout,legal,ui}/**/*.{ts,tsx}'),
    join(__dirname, '../frontend/src/app/(app)/(site)/**/*.{ts,tsx}'),
  ],
};
