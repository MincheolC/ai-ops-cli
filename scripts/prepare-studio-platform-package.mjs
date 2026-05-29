/* global console */

import { chmodSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceBinary = join(repoRoot, 'apps/studio/src-tauri/target/release/ai-ops-studio');
const targetBinary = join(repoRoot, 'apps/studio-darwin-arm64/bin/ai-ops-studio');

const assertFile = (path) => {
  try {
    if (statSync(path).isFile()) {
      return;
    }
  } catch {
    // Fall through to the shared error message below.
  }

  throw new Error(`Expected Studio release binary at ${path}. Run npm run tauri:release --workspace=apps/studio first.`);
};

assertFile(sourceBinary);
mkdirSync(dirname(targetBinary), { recursive: true });
copyFileSync(sourceBinary, targetBinary);
chmodSync(targetBinary, 0o755);

console.log(`Prepared ${targetBinary}`);
