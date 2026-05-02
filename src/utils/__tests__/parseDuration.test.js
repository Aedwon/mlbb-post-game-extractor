import { describe, test, expect } from 'vitest';
import { parseDuration } from '../parseDuration';

describe('parseDuration', () => {
  test('parses MM:SS to total seconds', () => {
    expect(parseDuration('09:58')).toBe(598);
  });

  test('handles single-digit minutes', () => {
    expect(parseDuration('1:23')).toBe(83);
  });

  test('returns null for empty string', () => {
    expect(parseDuration('')).toBeNull();
  });

  test('returns null for non-numeric input', () => {
    expect(parseDuration('abc')).toBeNull();
  });

  test('returns null for HH:MM:SS format', () => {
    expect(parseDuration('12:34:56')).toBeNull();
  });

  test('trims whitespace', () => {
    expect(parseDuration('  09:58  ')).toBe(598);
  });

  test('returns null for null input', () => {
    expect(parseDuration(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(parseDuration(undefined)).toBeNull();
  });
});
