export const deepMerge = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
};

export const deepRemoveKeys = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in result)) continue;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      const nested = deepRemoveKeys(result[key] as Record<string, unknown>, value as Record<string, unknown>);
      if (Object.keys(nested).length === 0) {
        delete result[key];
      } else {
        result[key] = nested;
      }
    } else {
      delete result[key];
    }
  }
  return result;
};
