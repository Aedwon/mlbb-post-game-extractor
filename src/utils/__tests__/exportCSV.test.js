import { describe, test, expect } from 'vitest';
import { exportLongCSV, MATCH_COLS, STAT_COLS } from '../exportCSV';

const ROLES = ['exp', 'jungle', 'mid', 'roam', 'gold'];

const makePlayer = (idx, side, role, overrides = {}) => ({
  player_index: idx,
  side,
  role,
  ign: `player${idx}`,
  hero: `Hero${idx}`,
  kills: idx,
  deaths: 0,
  assists: 0,
  gold: 1000 + idx * 100,
  rating: 5.0,
  hero_dmg: 10000,
  consec_kills: 0,
  teamfight_pct: '50%',
  crowd_control: 0,
  healing_shields: 0,
  dmg_taken: 5000,
  hero_dmg_overall: 10000,
  turret_dmg: 0,
  dmg_taken_overall: 5000,
  teamfight_pct_overall: '50%',
  total_gold: 1000 + idx * 100,
  jungle_gold: 0,
  kill_gold: 0,
  minion_gold: 0,
  ...overrides,
});

const makeMatch = (overrides = {}) => ({
  battle_id: 'BID123',
  match_timestamp: '12:34:56 PM',
  patch: '1.9.42',
  duration: 598,
  winning_side: 'blue',
  ban_mode: 6,
  blue_ban_1: 'Hayabusa', blue_ban_2: 'Kagura', blue_ban_3: 'Lancelot',
  blue_ban_4: '', blue_ban_5: '',
  red_ban_1: 'Fanny', red_ban_2: 'Karrie', red_ban_3: 'Wanwan',
  red_ban_4: '', red_ban_5: '',
  players: [
    ...ROLES.map((r, i) => makePlayer(i + 1, 'blue', r)),
    ...ROLES.map((r, i) => makePlayer(i + 6, 'red', r)),
  ],
  ...overrides,
});

describe('exportLongCSV', () => {
  test('emits 11 lines: 1 header + 10 player rows', () => {
    const csv = exportLongCSV(makeMatch());
    expect(csv.split('\n')).toHaveLength(11);
  });

  test('header has exactly 40 columns', () => {
    const csv = exportLongCSV(makeMatch());
    const header = csv.split('\n')[0];
    expect(header.split(',')).toHaveLength(40);
  });

  test('every data row has 40 values', () => {
    const csv = exportLongCSV(makeMatch());
    const rows = csv.split('\n').slice(1);
    for (const row of rows) {
      expect(row.split(',')).toHaveLength(40);
    }
  });

  test('match metadata is denormalized across all 10 rows', () => {
    const csv = exportLongCSV(makeMatch());
    const rows = csv.split('\n').slice(1);
    for (const row of rows) {
      expect(row).toContain('BID123');
      expect(row).toContain('1.9.42');
      expect(row).toContain('598');
    }
  });

  test('first column is battle_id', () => {
    const csv = exportLongCSV(makeMatch());
    const headers = csv.split('\n')[0].split(',');
    expect(headers[0]).toBe('battle_id');
  });

  test('CSV-escapes values with commas', () => {
    const match = makeMatch();
    match.players[0].ign = 'player, with comma';
    const csv = exportLongCSV(match);
    expect(csv).toContain('"player, with comma"');
  });

  test('renders blank for missing optional fields', () => {
    const match = makeMatch({ patch: '', duration: null });
    const csv = exportLongCSV(match);
    const dataRow = csv.split('\n')[1];
    const cols = dataRow.split(',');
    const headers = csv.split('\n')[0].split(',');
    expect(cols[headers.indexOf('patch')]).toBe('');
    expect(cols[headers.indexOf('duration')]).toBe('');
  });

  test('exports MATCH_COLS as 16 columns', () => {
    expect(MATCH_COLS).toHaveLength(16);
  });

  test('exports STAT_COLS as 19 columns', () => {
    expect(STAT_COLS).toHaveLength(19);
  });
});
