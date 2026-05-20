/* global console, process */

import { accessSync, constants, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const isExecutable = (path) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const resolveFromPath = (command) => {
  const pathEntries = process.env.PATH?.split(delimiter) ?? [];
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

  for (const pathEntry of pathEntries) {
    for (const extension of extensions) {
      const candidate = join(pathEntry, `${command}${extension}`);
      if (existsSync(candidate) && isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

const resolveCargo = () => {
  if (process.env.CARGO !== undefined && process.env.CARGO.length > 0) {
    return process.env.CARGO;
  }

  const pathCargo = resolveFromPath('cargo');
  if (pathCargo !== null) {
    return pathCargo;
  }

  const rustupCargo = join(homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo');
  if (existsSync(rustupCargo) && isExecutable(rustupCargo)) {
    return rustupCargo;
  }

  return null;
};

const cargo = resolveCargo();

if (cargo === null) {
  console.error(
    'cargo not found. Install Rust or set CARGO to the cargo executable before running Studio Tauri checks.',
  );
  process.exitCode = 127;
} else {
  const result = spawnSync(cargo, ['check', '--manifest-path', 'src-tauri/Cargo.toml'], {
    stdio: 'inherit',
  });

  process.exitCode = result.status ?? 1;
}
