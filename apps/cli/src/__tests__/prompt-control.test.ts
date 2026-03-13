import { describe, expect, it } from 'vitest';
import { PROMPT_CANCELLED, isPromptCancelled } from '../lib/prompt-control.js';

describe('prompt-control', () => {
  it('cancellation sentinel을 식별한다', () => {
    expect(isPromptCancelled(PROMPT_CANCELLED)).toBe(true);
  });

  it('일반 값은 cancellation으로 취급하지 않는다', () => {
    expect(isPromptCancelled(null)).toBe(false);
    expect(isPromptCancelled(false)).toBe(false);
    expect(isPromptCancelled(['codex'])).toBe(false);
  });
});
