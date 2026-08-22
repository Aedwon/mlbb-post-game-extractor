import { describe, expect, it } from 'vitest';
import {
  getOCRProfile,
  normalizeOCRText,
  selectBestOCRCandidate,
  shouldRetryOCRCandidate,
  validateOCRValue,
} from '../ocrNumbers';

describe('numeric OCR profiles', () => {
  it('uses the blue-field profile for mirrored red fields', () => {
    expect(getOCRProfile('rating_red').kind).toBe('rating');
    expect(getOCRProfile('teamfight_red').kind).toBe('percent');
  });
});

describe('normalizeOCRText', () => {
  it('recovers common OCR digit confusions', () => {
    expect(normalizeOCRText('O1S8', 'kills')).toBe('0158');
  });

  it('normalizes duration separators and can recover a dropped separator', () => {
    expect(normalizeOCRText('12/34', 'duration')).toBe('12:34');
    expect(normalizeOCRText('9.07', 'duration')).toBe('9:07');
    expect(normalizeOCRText('934', 'duration')).toBe('9:34');
  });

  it('normalizes MLBB decimal ratings', () => {
    expect(normalizeOCRText('8/3', 'rating')).toBe('8.3');
    expect(normalizeOCRText('83', 'rating')).toBe('8.3');
    expect(normalizeOCRText('120', 'rating')).toBe('12.0');
  });

  it('adds the semantic percent suffix when Tesseract misses the glyph', () => {
    expect(normalizeOCRText('59', 'teamfight')).toBe('59%');
  });
});

describe('validateOCRValue', () => {
  it('rejects impossible percentages and malformed durations', () => {
    expect(validateOCRValue('100%', 'teamfight')).toBe(true);
    expect(validateOCRValue('101%', 'teamfight')).toBe(false);
    expect(validateOCRValue('19:59', 'duration')).toBe(true);
    expect(validateOCRValue('19:67', 'duration')).toBe(false);
  });

  it('enforces short-stat and rating ranges', () => {
    expect(validateOCRValue('27', 'kills')).toBe(true);
    expect(validateOCRValue('127', 'kills')).toBe(false);
    expect(validateOCRValue('12.0', 'rating')).toBe(true);
    expect(validateOCRValue('83.0', 'rating')).toBe(false);
  });

  it('accepts plausible battle ids and rejects short fragments', () => {
    expect(validateOCRValue('162905723312573351', 'battle_id')).toBe(true);
    expect(validateOCRValue('1629057', 'battle_id')).toBe(false);
  });
});

describe('OCR candidate selection', () => {
  it('prefers a valid lower-confidence value over an impossible high-confidence one', () => {
    const best = selectBestOCRCandidate([
      { text: '159%', confidence: 96, variant: 'normalized' },
      { text: '59%', confidence: 82, variant: 'binary' },
    ], 'teamfight');

    expect(best.text).toBe('59%');
    expect(best.valid).toBe(true);
  });

  it('retries low-confidence or structurally suspicious readings', () => {
    expect(shouldRetryOCRCandidate({ text: '8.3', confidence: 92 }, 'rating')).toBe(false);
    expect(shouldRetryOCRCandidate({ text: '83', confidence: 92 }, 'rating')).toBe(true);
    expect(shouldRetryOCRCandidate({ text: '18:45', confidence: 60 }, 'duration')).toBe(true);
  });
});
