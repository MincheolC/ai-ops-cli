type TomlPrimitive = string | number | boolean | string[];

const parseTomlValue = (value: string): TomlPrimitive => {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
    throw new Error(`Unsupported TOML value: ${value}`);
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const numericValue = Number(trimmed);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  throw new Error(`Unsupported TOML value: ${value}`);
};

export const parseFlatToml = (content: string): Record<string, TomlPrimitive> => {
  const result: Record<string, TomlPrimitive> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!match) {
      throw new Error(`Unsupported TOML line: ${line}`);
    }

    const [, key, value] = match;
    result[key] = parseTomlValue(value);
  }

  return result;
};

const renderTomlValue = (value: TomlPrimitive): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
};

export const renderFlatToml = (entries: readonly [string, TomlPrimitive][]): string =>
  entries.map(([key, value]) => `${key} = ${renderTomlValue(value)}`).join('\n');
