import { describe, test, expect } from 'vitest';
import { validateRoster } from '../validateRoster';

const ROLES = ['exp', 'jungle', 'mid', 'roam', 'gold'];

const makePlayer = (overrides = {}) => ({
  player_index: 1,
  hero: 'Lancelot',
  role: 'jungle',
  ...overrides,
});

const makeCleanRoster = () => [
  ...ROLES.map((role, i) => makePlayer({ player_index: i + 1, role })),
  ...ROLES.map((role, i) => makePlayer({ player_index: i + 6, role })),
];

describe('validateRoster', () => {
  test('clean roster passes', () => {
    const result = validateRoster(makeCleanRoster());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('flags duplicate role on Blue side', () => {
    const players = makeCleanRoster();
    players[0].role = 'mid';
    players[2].role = 'mid';
    const result = validateRoster(players);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Blue side has 2x mid');
  });

  test('flags duplicate role on Red side', () => {
    const players = makeCleanRoster();
    players[5].role = 'jungle';
    const result = validateRoster(players);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Red side has 2x jungle');
  });

  test('flags missing hero', () => {
    const players = makeCleanRoster();
    players[3].hero = '';
    const result = validateRoster(players);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Player 4 missing hero');
  });

  test('flags missing role', () => {
    const players = makeCleanRoster();
    players[5].role = '';
    const result = validateRoster(players);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Player 6 missing role');
  });

  test('flags missing hero with whitespace-only value', () => {
    const players = makeCleanRoster();
    players[0].hero = '   ';
    const result = validateRoster(players);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Player 1 missing hero');
  });

  test('returns multiple errors when multiple problems exist', () => {
    const players = makeCleanRoster();
    players[0].hero = '';
    players[1].role = 'mid';
    players[2].role = 'mid';
    const result = validateRoster(players);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
