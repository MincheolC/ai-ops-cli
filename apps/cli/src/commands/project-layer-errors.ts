import * as p from '@clack/prompts';
import { ZodError } from 'zod';

export const formatProjectLayerManifestReadError = (error: unknown): string => {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'manifest';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
  }

  return error instanceof Error ? error.message : 'unknown error';
};

export const reportInvalidProjectLayerManifest = (params: { error: unknown; outro: string }): void => {
  const reason = formatProjectLayerManifestReadError(params.error);
  p.log.error(`[invalid-manifest] .ai-ops/manifest.json 파싱 실패: ${reason}`);
  process.exitCode = 1;
  p.outro(params.outro);
};
