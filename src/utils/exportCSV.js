export const MATCH_COLS = [
  'battle_id', 'match_timestamp', 'patch', 'duration', 'winning_side', 'ban_mode',
  'blue_ban_1', 'blue_ban_2', 'blue_ban_3', 'blue_ban_4', 'blue_ban_5',
  'red_ban_1', 'red_ban_2', 'red_ban_3', 'red_ban_4', 'red_ban_5',
];

export const STAT_COLS = [
  'kills', 'deaths', 'assists', 'gold', 'rating',
  'hero_dmg', 'consec_kills',
  'teamfight_pct', 'crowd_control', 'healing_shields', 'dmg_taken',
  'hero_dmg_overall', 'turret_dmg', 'dmg_taken_overall', 'teamfight_pct_overall',
  'total_gold', 'jungle_gold', 'kill_gold', 'minion_gold',
];

export const PLAYER_META_COLS = ['player_index', 'side', 'role', 'ign', 'hero'];

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values) {
  return values.map(csvEscape).join(',');
}

export function exportLongCSV(match) {
  const headers = [...MATCH_COLS, ...PLAYER_META_COLS, ...STAT_COLS];
  const lines = [csvRow(headers)];

  for (const player of match.players) {
    const matchValues = MATCH_COLS.map(c => match[c]);
    const playerValues = PLAYER_META_COLS.map(c => player[c]);
    const statValues = STAT_COLS.map(c => player[c]);
    lines.push(csvRow([...matchValues, ...playerValues, ...statValues]));
  }

  return lines.join('\n');
}
