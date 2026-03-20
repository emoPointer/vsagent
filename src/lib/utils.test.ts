import { describe, it, expect } from 'vitest';
import { truncate, classNames } from './utils';

describe('truncate', () => {
  it('returns text unchanged when under limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis when over limit', () => {
    const result = truncate('hello world', 5);
    expect(result).toBe('hello…');
    expect(result.length).toBe(6);
  });
});

describe('classNames', () => {
  it('joins truthy class names', () => {
    expect(classNames('a', 'b', false, undefined, 'c')).toBe('a b c');
  });
});
