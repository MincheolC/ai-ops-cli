import { describe, expect, it } from 'vitest';
import {
  parseStudioSnapshotEnvelope,
  STUDIO_SNAPSHOT_KIND,
  STUDIO_SNAPSHOT_SCHEMA_VERSION,
  StudioSnapshotParseError,
} from './studio-snapshot';

const validSnapshot = {
  kind: STUDIO_SNAPSHOT_KIND,
  schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
  generatedAt: '2026-05-19T00:00:00.000Z',
  cliVersion: '1.3.1',
  project: {
    root: '/workspace/project',
  },
  runtime: {
    available: true,
  },
};

describe('studio snapshot bridge parser', () => {
  it('accepts a valid top-level snapshot envelope', () => {
    expect(parseStudioSnapshotEnvelope(JSON.stringify(validSnapshot))).toEqual(validSnapshot);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseStudioSnapshotEnvelope('{nope')).toThrow(StudioSnapshotParseError);
  });

  it('rejects unexpected snapshot kind', () => {
    expect(() =>
      parseStudioSnapshotEnvelope(
        JSON.stringify({
          ...validSnapshot,
          kind: 'other-snapshot',
        }),
      ),
    ).toThrow('unexpected kind');
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parseStudioSnapshotEnvelope(
        JSON.stringify({
          ...validSnapshot,
          schemaVersion: 2,
        }),
      ),
    ).toThrow('unsupported schemaVersion');
  });

  it('rejects missing project or runtime objects', () => {
    expect(() =>
      parseStudioSnapshotEnvelope(
        JSON.stringify({
          ...validSnapshot,
          project: null,
        }),
      ),
    ).toThrow('project must be an object');

    expect(() =>
      parseStudioSnapshotEnvelope(
        JSON.stringify({
          ...validSnapshot,
          runtime: [],
        }),
      ),
    ).toThrow('runtime must be an object');
  });
});
