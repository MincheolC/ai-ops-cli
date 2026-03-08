import { describe, it, expect } from 'vitest';
import { deepMerge, deepRemoveKeys } from '../lib/deep-merge.util.js';

describe('deepMerge', () => {
  it('flat 키 병합', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('중첩 객체 deep merge', () => {
    const result = deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 99, z: 3 } });
    expect(result).toEqual({ a: { x: 1, y: 99, z: 3 } });
  });

  it('원본 변경 없음 (immutable)', () => {
    const base = { a: 1 };
    deepMerge(base, { b: 2 });
    expect(base).toEqual({ a: 1 });
  });
});

describe('deepRemoveKeys', () => {
  it('flat 키 제거', () => {
    const result = deepRemoveKeys({ a: 1, b: 2 }, { a: 1 });
    expect(result).toEqual({ b: 2 });
  });

  it('중첩 키 제거', () => {
    const result = deepRemoveKeys({ general: { plan: { directory: '.gemini/plans', modelRouting: true }, other: 'x' } }, { general: { plan: { directory: '.gemini/plans', modelRouting: true } } });
    expect(result).toEqual({ general: { other: 'x' } });
  });

  it('빈 부모 객체 정리', () => {
    const result = deepRemoveKeys({ general: { plan: { directory: '.gemini/plans' } } }, { general: { plan: { directory: '.gemini/plans' } } });
    expect(result).toEqual({});
  });

  it('존재하지 않는 키는 무시', () => {
    const result = deepRemoveKeys({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1 });
  });

  it('원본 변경 없음 (immutable)', () => {
    const base = { a: 1, b: 2 };
    deepRemoveKeys(base, { a: 1 });
    expect(base).toEqual({ a: 1, b: 2 });
  });
});
