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

import { exportWideCSV } from '../exportCSV';

describe('exportWideCSV', () => {
  test('emits 2 lines: header + 1 data row', () => {
    const csv = exportWideCSV(makeMatch());
    expect(csv.split('\n')).toHaveLength(2);
  });

  test('header has exactly 226 columns', () => {
    const csv = exportWideCSV(makeMatch());
    const header = csv.split('\n')[0];
    expect(header.split(',')).toHaveLength(226);
  });

  test('data row has exactly 226 values', () => {
    const csv = exportWideCSV(makeMatch());
    const dataRow = csv.split('\n')[1];
    expect(dataRow.split(',')).toHaveLength(226);
  });

  test('headers follow blue-then-red, exp/jungle/mid/roam/gold order', () => {
    const csv = exportWideCSV(makeMatch());
    const header = csv.split('\n')[0];
    expect(header).toContain('blue_exp_kills');
    expect(header).toContain('blue_gold_minion_gold');
    expect(header).toContain('red_exp_ign');
    expect(header).toContain('red_gold_minion_gold');
    expect(header.indexOf('blue_exp_ign')).toBeLessThan(header.indexOf('blue_jungle_ign'));
    expect(header.indexOf('blue_gold_minion_gold')).toBeLessThan(header.indexOf('red_exp_ign'));
  });

  test('match metadata appears once at the start of the row', () => {
    const csv = exportWideCSV(makeMatch());
    const [header, row] = csv.split('\n');
    const headerCols = header.split(',');
    const rowCols = row.split(',');
    expect(headerCols[0]).toBe('battle_id');
    expect(rowCols[0]).toBe('BID123');
  });

  test('handles 6-ban mode with blank slots 4 and 5', () => {
    const csv = exportWideCSV(makeMatch());
    const [header, row] = csv.split('\n');
    const headerCols = header.split(',');
    const rowCols = row.split(',');
    const ban4Idx = headerCols.indexOf('blue_ban_4');
    expect(rowCols[ban4Idx]).toBe('');
  });

  test('emits empty values when a slot has no matching player', () => {
    // Build a match where Blue has no Mid laner (incomplete roster, edge case)
    const match = makeMatch();
    match.players = match.players.filter(p => !(p.side === 'blue' && p.role === 'mid'));
    const csv = exportWideCSV(match);
    const [header, row] = csv.split('\n');
    const headerCols = header.split(',');
    const rowCols = row.split(',');
    const blueMidKillsIdx = headerCols.indexOf('blue_mid_kills');
    expect(rowCols[blueMidKillsIdx]).toBe('');
  });

  test('CSV-escapes values with commas or quotes', () => {
    const match = makeMatch();
    match.players[0].ign = 'player, "comma" guy';
    const csv = exportWideCSV(match);
    expect(csv).toContain('"player, ""comma"" guy"');
  });
});
