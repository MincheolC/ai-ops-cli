export const PROMPT_CANCELLED = Symbol('prompt-cancelled');

export type PromptCancelled = typeof PROMPT_CANCELLED;

export const isPromptCancelled = <T>(value: T | PromptCancelled): value is PromptCancelled =>
  value === PROMPT_CANCELLED;
