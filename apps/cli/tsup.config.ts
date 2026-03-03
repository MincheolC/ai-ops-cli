import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/index': 'src/bin/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['@clack/prompts', 'commander'],
});
