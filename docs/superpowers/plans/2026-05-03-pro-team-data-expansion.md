# Pro-Team Data Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the MLBB stat extractor with manual entry for game patch, bans (6/10 mode), winning side, hero, role, and OCR for match duration; output two new CSV formats (long per-player, wide per-match with role-positional columns).

**Architecture:** Bolt-on additive changes to the existing React + Vite + Tesseract.js app. New pre-OCR `MatchMetadataForm` panel above the gallery; extend `ReviewModal` with hero/role dropdowns; new pure-function utilities for CSV serialization, roster validation, and duration parsing; format-toggle modal on export. Existing OCR pipeline, BattleID verification, IGN history, and bounding-box presets are untouched except for one new `duration` box and one `RED_COLUMN_ORDER.dps` bug fix.

**Tech Stack:** React 18, Vite 5, Tesseract.js 5, Vitest (new), Lucide React. No TypeScript. No CSS framework. Browser localStorage for persistence (existing keys only).

**Reference spec:** `docs/superpowers/specs/2026-05-02-pro-team-data-expansion-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `src/utils/parseDuration.js` | Pure: convert OCR'd `MM:SS` string → integer seconds, or null |
| `src/utils/validateRoster.js` | Pure: given 10-player array, return `{valid, errors[]}` for role uniqueness + completeness |
| `src/utils/exportCSV.js` | Pure: `exportLongCSV(match)` and `exportWideCSV(match)` serializers; shared `STAT_COLS`/`MATCH_COLS`/`csvEscape` helpers |
| `src/constants/mlbbHeroes.js` | Static array of hero name strings for typeahead |
| `src/constants/mlbbRoles.js` | The 5 role tokens + role-position display order |
| `src/components/MatchMetadataForm.jsx` | Pre-OCR form: patch, winner, ban mode, ban hero dropdowns |
| `src/utils/__tests__/parseDuration.test.js` | Vitest unit tests |
| `src/utils/__tests__/validateRoster.test.js` | Vitest unit tests |
| `src/utils/__tests__/exportCSV.test.js` | Vitest unit tests |
| `vitest.config.js` | Vitest config (node env, jsx via @vitejs/plugin-react if needed later) |

### Modified files

| File | Change |
|---|---|
| `package.json` | Add `vitest` devDep; add `test` and `test:watch` scripts |
| `src/components/ReviewModal.jsx` | Group existing items by player_index; add hero typeahead + role dropdown per row; surface validation errors; gate `COMMIT_CHANGES` button |
| `src/components/DataTable.jsx` | Replace inline CSV builder with new `exportCSV.js` utilities; add Long/Wide format choice modal on export |
| `src/App.jsx` | Add `MatchMetadataForm` above gallery; wire `playerAssignments` state through ReviewModal; add `duration` header box to Main preset; fix `RED_COLUMN_ORDER.dps`; bundle metadata + assignments into `savedRows` entries; parse OCR'd duration via `parseDuration` |

---

## Task 1: Vitest setup + smoke test

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `src/utils/__tests__/smoke.test.js` (deleted at end of task)

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

Expected: vitest added to devDependencies in `package.json`.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
});
```

- [ ] **Step 4: Write a smoke test**

Create `src/utils/__tests__/smoke.test.js`:

```js
import { describe, test, expect } from 'vitest';

describe('smoke', () => {
  test('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

```bash
npm test
```

Expected output: `1 passed`.

- [ ] **Step 6: Delete the smoke test file**

```bash
rm src/utils/__tests__/smoke.test.js
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add Vitest as test framework"
```

---

## Task 2: `parseDuration` utility (TDD)

**Files:**
- Create: `src/utils/parseDuration.js`
- Create: `src/utils/__tests__/parseDuration.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/parseDuration.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- parseDuration
```

Expected: ALL tests fail with "Cannot find module '../parseDuration'".

- [ ] **Step 3: Implement `parseDuration`**

Create `src/utils/parseDuration.js`:

```js
export function parseDuration(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- parseDuration
```

Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseDuration.js src/utils/__tests__/parseDuration.test.js
git commit -m "feat(utils): add parseDuration for OCR'd MM:SS → seconds"
```

---

## Task 3: `validateRoster` utility (TDD)

**Files:**
- Create: `src/utils/validateRoster.js`
- Create: `src/utils/__tests__/validateRoster.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/validateRoster.test.js`:

```js
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
    players[7].role = 'jungle';
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- validateRoster
```

Expected: ALL tests fail with module-not-found.

- [ ] **Step 3: Implement `validateRoster`**

Create `src/utils/validateRoster.js`:

```js
export function validateRoster(players) {
  const errors = [];

  for (const p of players) {
    if (!p.hero || String(p.hero).trim() === '') {
      errors.push(`Player ${p.player_index} missing hero`);
    }
    if (!p.role || String(p.role).trim() === '') {
      errors.push(`Player ${p.player_index} missing role`);
    }
  }

  const sides = { blue: [], red: [] };
  for (const p of players) {
    if (!p.role) continue;
    const sideKey = p.player_index <= 5 ? 'blue' : 'red';
    sides[sideKey].push(p.role);
  }

  for (const sideKey of ['blue', 'red']) {
    const counts = {};
    for (const role of sides[sideKey]) {
      counts[role] = (counts[role] || 0) + 1;
    }
    for (const [role, count] of Object.entries(counts)) {
      if (count > 1) {
        const label = sideKey === 'blue' ? 'Blue' : 'Red';
        errors.push(`${label} side has ${count}x ${role}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- validateRoster
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/validateRoster.js src/utils/__tests__/validateRoster.test.js
git commit -m "feat(utils): add validateRoster for role uniqueness + completeness"
```

---

## Task 4: `mlbbRoles` constant

**Files:**
- Create: `src/constants/mlbbRoles.js`

- [ ] **Step 1: Create the file**

```js
// The 5 standard MLBB roles, lowercase tokens used in the data schema.
export const ROLES = ['gold', 'exp', 'mid', 'jungle', 'roam'];

// Industry-standard role display order for the wide-format CSV slot order.
// Differs from ROLES (which is alphabetical-ish for dropdown UX).
export const ROLE_DISPLAY_ORDER = ['exp', 'jungle', 'mid', 'roam', 'gold'];

// Human-readable labels for UI dropdowns.
export const ROLE_LABELS = {
  gold: 'Gold Lane',
  exp: 'EXP Lane',
  mid: 'Mid Lane',
  jungle: 'Jungle',
  roam: 'Roam',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/mlbbRoles.js
git commit -m "feat(constants): add MLBB roles + display order"
```

---

## Task 5: `mlbbHeroes` constant

**Files:**
- Create: `src/constants/mlbbHeroes.js`

- [ ] **Step 1: Create the file with a comprehensive hero list**

The list below is hand-maintained for this PoC. After creating the file, the engineer (or analyst) should cross-check it against the in-game hero roster and add any heroes released after this writing. The `MatchMetadataForm` and `ReviewModal` will allow free-text fallback for any hero not in this list.

```js
// MLBB hero roster (PoC, hand-maintained).
// Sorted alphabetically. Cross-check against in-game roster before shipping.
// New heroes can be added here, OR users can free-text type them via the dropdown's fallback.

export const HEROES = [
  'Aamon', 'Akai', 'Aldous', 'Alice', 'Alpha', 'Alucard', 'Angela', 'Argus',
  'Arlott', 'Atlas', 'Aulus', 'Aurora', 'Badang', 'Balmond', 'Bane', 'Barats',
  'Baxia', 'Beatrix', 'Belerick', 'Benedetta', 'Brody', 'Bruno', 'Carmilla',
  'Cecilion', 'Chang\'e', 'Chip', 'Chou', 'Claude', 'Clint', 'Cyclops',
  'Diggie', 'Dyrroth', 'Edith', 'Esmeralda', 'Estes', 'Eudora', 'Fanny',
  'Faramis', 'Floryn', 'Franco', 'Fredrinn', 'Freya', 'Gatotkaca', 'Gloo',
  'Gord', 'Granger', 'Grock', 'Guinevere', 'Gusion', 'Hanabi', 'Hanzo',
  'Harith', 'Harley', 'Hayabusa', 'Helcurt', 'Hilda', 'Hylos', 'Irithel',
  'Ixia', 'Jawhead', 'Johnson', 'Joy', 'Julian', 'Kadita', 'Kagura', 'Kaja',
  'Karina', 'Karrie', 'Khaleed', 'Khufra', 'Kimmy', 'Lancelot', 'Lapu-Lapu',
  'Layla', 'Leomord', 'Lesley', 'Ling', 'Lolita', 'Lou Yi', 'Lukas', 'Lunox',
  'Luo Yi', 'Lylia', 'Martis', 'Masha', 'Mathilda', 'Melissa', 'Minotaur',
  'Minsitthar', 'Miya', 'Moskov', 'Nana', 'Natalia', 'Natan', 'Nolan',
  'Novaria', 'Odette', 'Paquito', 'Pharsa', 'Phoveus', 'Popol and Kupa',
  'Rafaela', 'Roger', 'Ruby', 'Saber', 'Selena', 'Silvanna', 'Sun', 'Suyou',
  'Terizla', 'Thamuz', 'Tigreal', 'Uranus', 'Vale', 'Valentina', 'Valir',
  'Vexana', 'Wanwan', 'X.Borg', 'Xavier', 'Yi Sun-shin', 'Yin', 'Yu Zhong',
  'Yve', 'Zetian', 'Zhask', 'Zhuxin', 'Zilong',
];
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/mlbbHeroes.js
git commit -m "feat(constants): add MLBB hero roster for typeahead"
```

---

## Task 6: `exportCSV.js` — long format (TDD)

**Files:**
- Create: `src/utils/exportCSV.js`
- Create: `src/utils/__tests__/exportCSV.test.js`

- [ ] **Step 1: Write the failing tests for long format**

Create `src/utils/__tests__/exportCSV.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- exportCSV
```

Expected: ALL tests fail with module-not-found.

- [ ] **Step 3: Implement `exportCSV.js` (long format only — wide added in next task)**

Create `src/utils/exportCSV.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- exportCSV
```

Expected: `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportCSV.js src/utils/__tests__/exportCSV.test.js
git commit -m "feat(utils): add exportLongCSV serializer (40 cols, 10 rows/match)"
```

---

## Task 7: `exportCSV.js` — wide format (TDD)

**Files:**
- Modify: `src/utils/exportCSV.js`
- Modify: `src/utils/__tests__/exportCSV.test.js`

- [ ] **Step 1: Append failing tests for wide format**

Append to `src/utils/__tests__/exportCSV.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
npm test -- exportCSV
```

Expected: 9 passed (existing) + 8 failing (new wide-format).

- [ ] **Step 3: Add `exportWideCSV` to `src/utils/exportCSV.js`**

Append to `src/utils/exportCSV.js`:

```js
const ROLE_DISPLAY_ORDER = ['exp', 'jungle', 'mid', 'roam', 'gold'];
const SIDES = ['blue', 'red'];

export function exportWideCSV(match) {
  const slotHeaders = [];
  const slotValues = [];

  for (const side of SIDES) {
    for (const role of ROLE_DISPLAY_ORDER) {
      const player = match.players.find(p => p.side === side && p.role === role);
      const slotPrefix = `${side}_${role}`;

      slotHeaders.push(`${slotPrefix}_ign`, `${slotPrefix}_hero`);
      slotValues.push(player?.ign ?? '', player?.hero ?? '');

      for (const stat of STAT_COLS) {
        slotHeaders.push(`${slotPrefix}_${stat}`);
        slotValues.push(player?.[stat] ?? '');
      }
    }
  }

  const headers = [...MATCH_COLS, ...slotHeaders];
  const matchValues = MATCH_COLS.map(c => match[c]);

  return [csvRow(headers), csvRow([...matchValues, ...slotValues])].join('\n');
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm test -- exportCSV
```

Expected: `17 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportCSV.js src/utils/__tests__/exportCSV.test.js
git commit -m "feat(utils): add exportWideCSV (226 cols, role-positional)"
```

---

## Task 8: Add `duration` OCR box to Main preset

**Files:**
- Modify: `src/App.jsx` (around line 13–21, the `BASE_PRESETS.main` array)

- [ ] **Step 1: Add the `duration` header box**

In `src/App.jsx`, change the `main` preset in `BASE_PRESETS` from:

```js
  main: [
    { id: 'battle_id', label: 'Battle ID', x: 20, y: 700, width: 250, height: 40, type: 'header' },
    { id: 'kills', label: 'Kills', x: 400, y: 350, width: 40, height: 400 },
    { id: 'deaths', label: 'Deaths', x: 450, y: 350, width: 40, height: 400 },
    { id: 'assists', label: 'Assists', x: 500, y: 350, width: 40, height: 400 },
    { id: 'gold', label: 'Gold', x: 550, y: 350, width: 80, height: 400 },
    { id: 'rating', label: 'Rating', x: 650, y: 350, width: 60, height: 400 }
  ],
```

to:

```js
  main: [
    { id: 'battle_id', label: 'Battle ID', x: 20, y: 700, width: 250, height: 40, type: 'header' },
    { id: 'duration', label: 'Duration', x: 1700, y: 100, width: 200, height: 50, type: 'header' },
    { id: 'kills', label: 'Kills', x: 400, y: 350, width: 40, height: 400 },
    { id: 'deaths', label: 'Deaths', x: 450, y: 350, width: 40, height: 400 },
    { id: 'assists', label: 'Assists', x: 500, y: 350, width: 40, height: 400 },
    { id: 'gold', label: 'Gold', x: 550, y: 350, width: 80, height: 400 },
    { id: 'rating', label: 'Rating', x: 650, y: 350, width: 60, height: 400 }
  ],
```

- [ ] **Step 2: Manually verify**

Run `npm run dev`, upload a Main-tab screenshot, switch to the Main preset, and confirm a new "Duration" bounding box appears near the top-right of the image. Drag/resize it to fit the actual duration text region.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(ocr): add duration bounding box to Main tab preset"
```

---

## Task 9: Fix DPS red-side column-swap bug

**Files:**
- Modify: `src/App.jsx` (around line 49–51, the `RED_COLUMN_ORDER` constant)

- [ ] **Step 1: Inspect a DPS-tab screenshot to confirm column order**

Open the user's sample DPS-tab screenshot in any image viewer. Note the visual order of the columns on the **red side** (right half of the image) — typically `[hero_dmg, consec_kills]` or `[consec_kills, hero_dmg]`. The hypothesis is that red-side renders columns in the OPPOSITE order from blue-side, which is why the existing CSV swaps them.

Verification anchor: in the existing sample export `mlbb_batch_stats_1777486564981.csv`, red-side rows have `Consecutive Kills` values that are clearly Hero Damage (5-digit numbers) and `Hero Damage` values that are clearly Consec Kills (single-digit). This confirms the swap.

- [ ] **Step 2: Add the `dps` entry to `RED_COLUMN_ORDER`**

In `src/App.jsx`, change:

```js
const RED_COLUMN_ORDER = {
  main: ['gold', 'kills', 'deaths', 'assists', 'rating'],
};
```

to:

```js
const RED_COLUMN_ORDER = {
  main: ['gold', 'kills', 'deaths', 'assists', 'rating'],
  dps: ['consec_kills', 'hero_dmg'],
};
```

If Step 1 verification reveals the red-side actually renders in the SAME order as blue (`['hero_dmg', 'consec_kills']`), the existing data discrepancy must have a different cause and this fix should be skipped — flag it back for re-investigation rather than committing a guess.

- [ ] **Step 3: Manually verify the fix**

Run `npm run dev`. Upload the same sample screenshot. Run OCR on DPS tab. Inspect the review modal: red-side `hero_dmg` values should now be 5-digit and `consec_kills` values should now be single-digit. If swapped the other way, swap the array values.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "fix(ocr): correct red-side column order on DPS tab"
```

---

## Task 10: Extend `ReviewModal` — group by player, add hero/role dropdowns

**Files:**
- Modify: `src/components/ReviewModal.jsx`

- [ ] **Step 1: Replace the entire file**

The existing modal is a flat list of (player, stat) cells. The new modal groups cells by player_index and adds two dropdowns per player. The contract changes: the modal now receives `data` (the existing OCR cells) plus `playerAssignments` (a `{[player_index]: {hero, role}}` map) and `onAssignmentsChange`. The parent (App.jsx) drives validation and disables the commit button via the existing `validateRoster` import.

Replace `src/components/ReviewModal.jsx` with:

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { HEROES } from '../constants/mlbbHeroes';
import { ROLES, ROLE_LABELS } from '../constants/mlbbRoles';
import { validateRoster } from '../utils/validateRoster';

export default function ReviewModal({
  data,
  playerAssignments,
  onAssignmentsChange,
  onConfirm,
  onCancel,
}) {
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    const initial = {};
    data.forEach(item => {
      initial[item.id] = item.text;
    });
    setEditedData(initial);
  }, [data]);

  // Group OCR items by player_index
  const playerGroups = useMemo(() => {
    const groups = {};
    for (const item of data) {
      const idx = item.playerIndex;
      if (!groups[idx]) groups[idx] = [];
      groups[idx].push(item);
    }
    return groups;
  }, [data]);

  const playerIndexes = Array.from({ length: 10 }, (_, i) => i + 1);

  // Build a 10-player array for validation
  const rosterForValidation = useMemo(() => {
    return playerIndexes.map(idx => ({
      player_index: idx,
      hero: playerAssignments[idx]?.hero || '',
      role: playerAssignments[idx]?.role || '',
    }));
  }, [playerAssignments]);

  const validation = useMemo(() => validateRoster(rosterForValidation), [rosterForValidation]);

  const handleChange = (id, val) => {
    setEditedData(prev => ({ ...prev, [id]: val }));
  };

  const handleAssignmentChange = (playerIdx, field, value) => {
    onAssignmentsChange({
      ...playerAssignments,
      [playerIdx]: {
        ...playerAssignments[playerIdx],
        [field]: value,
      },
    });
  };

  const handleConfirm = () => {
    if (!validation.valid) return;
    onConfirm(editedData);
  };

  // Per-player error highlighting
  const errorsByField = useMemo(() => {
    const map = {};
    for (const err of validation.errors) {
      const heroMatch = err.match(/^Player (\d+) missing hero$/);
      const roleMatch = err.match(/^Player (\d+) missing role$/);
      const dupMatch = err.match(/^(Blue|Red) side has \d+x (\w+)$/);
      if (heroMatch) map[`hero_${heroMatch[1]}`] = err;
      if (roleMatch) map[`role_${roleMatch[1]}`] = err;
      if (dupMatch) {
        const sideKey = dupMatch[1].toLowerCase();
        const role = dupMatch[2];
        for (const p of rosterForValidation) {
          const pSide = p.player_index <= 5 ? 'blue' : 'red';
          if (pSide === sideKey && p.role === role) {
            map[`role_${p.player_index}`] = err;
          }
        }
      }
    }
    return map;
  }, [validation.errors, rosterForValidation]);

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <header className="modal-header">
          <h2 className="text-gold">VERIFY_EXTRACTED_DATA</h2>
          <button className="btn-icon" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>

        <p className="subtitle">
          // Compare image snippets with OCR output. Assign hero + role per player.
        </p>

        {!validation.valid && (
          <div className="validation-banner" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem', marginBottom: '1rem',
            background: 'rgba(255, 80, 80, 0.1)',
            border: '1px solid rgba(255, 80, 80, 0.4)',
            borderRadius: '4px',
          }}>
            <AlertCircle size={16} color="#ff5050" />
            <span style={{ fontSize: '0.85rem' }}>
              {validation.errors.length} issue(s) — fix to enable commit
            </span>
          </div>
        )}

        <div className="review-list">
          {playerIndexes.map(idx => {
            const items = playerGroups[idx] || [];
            const heroErr = errorsByField[`hero_${idx}`];
            const roleErr = errorsByField[`role_${idx}`];
            return (
              <div key={idx} className="review-player-block" style={{
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '1rem', marginBottom: '1rem',
              }}>
                <div style={{
                  display: 'flex', gap: '1rem', alignItems: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <label className={idx <= 5 ? 'text-blue' : 'text-red'} style={{ minWidth: '90px' }}>
                    PLAYER_{idx}
                  </label>
                  <div style={{ flex: 1 }}>
                    <input
                      list={`hero-list-${idx}`}
                      value={playerAssignments[idx]?.hero || ''}
                      onChange={e => handleAssignmentChange(idx, 'hero', e.target.value)}
                      placeholder="Hero"
                      autoComplete="off"
                      style={heroErr ? { borderColor: '#ff5050' } : {}}
                      title={heroErr || ''}
                    />
                    <datalist id={`hero-list-${idx}`}>
                      {HEROES.map(h => <option key={h} value={h} />)}
                    </datalist>
                  </div>
                  <select
                    value={playerAssignments[idx]?.role || ''}
                    onChange={e => handleAssignmentChange(idx, 'role', e.target.value)}
                    style={roleErr ? { borderColor: '#ff5050' } : {}}
                    title={roleErr || ''}
                  >
                    <option value="">Role…</option>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="player-stat-row" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.5rem',
                }}>
                  {items.map(item => (
                    <div key={item.id} className="review-input-group">
                      <label style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                        {item.label.toUpperCase()}
                      </label>
                      <input
                        type="text"
                        value={editedData[item.id] || ''}
                        onChange={e => handleChange(item.id, e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>DISCARD</button>
          <button
            className="btn btn-cyan"
            onClick={handleConfirm}
            disabled={!validation.valid}
            style={!validation.valid ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            title={!validation.valid ? validation.errors.join('; ') : ''}
          >
            <Check size={16} /> COMMIT_CHANGES
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify the modal renders**

Run `npm run dev`, upload a Main-tab screenshot, run OCR. The review modal should now show 10 player blocks, each with: player label, hero typeahead, role dropdown, and the OCR'd stat inputs grouped beneath. Without filling hero/role, the commit button should be disabled and a red banner should show error count.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReviewModal.jsx
git commit -m "feat(review): group by player, add hero/role dropdowns + validation"
```

---

## Task 11: Create `MatchMetadataForm` component

**Files:**
- Create: `src/components/MatchMetadataForm.jsx`

- [ ] **Step 1: Create the component**

```jsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { HEROES } from '../constants/mlbbHeroes';

const DEFAULT_METADATA = {
  patch: '',
  winning_side: '',
  ban_mode: 6,
  bans: Array(10).fill(''),
};

export function makeDefaultMetadata() {
  return { ...DEFAULT_METADATA, bans: Array(10).fill('') };
}

export default function MatchMetadataForm({ metadata, onChange }) {
  const [collapsed, setCollapsed] = useState(false);

  const banSlots = metadata.ban_mode === 6 ? 6 : 10;

  // Ban draft order labels: alternating Blue/Red starting with Blue
  const banLabel = (i) => {
    const side = i % 2 === 0 ? 'Blue' : 'Red';
    return `Ban ${i + 1} (${side})`;
  };

  const updateField = (field, value) => {
    onChange({ ...metadata, [field]: value });
  };

  const updateBan = (i, value) => {
    const nextBans = [...metadata.bans];
    nextBans[i] = value;
    onChange({ ...metadata, bans: nextBans });
  };

  const handleBanModeChange = (mode) => {
    if (mode === 6 && metadata.ban_mode === 10) {
      const truncated = metadata.bans.slice(0, 6).concat(Array(4).fill(''));
      const wouldDiscard = metadata.bans.slice(6).some(b => b !== '');
      if (wouldDiscard) {
        // eslint-disable-next-line no-alert
        const ok = confirm('Switching to 6-ban mode discards bans 7–10. Continue?');
        if (!ok) return;
      }
      onChange({ ...metadata, ban_mode: 6, bans: truncated });
    } else {
      onChange({ ...metadata, ban_mode: mode });
    }
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <h3 style={{ margin: 0, fontSize: '0.95rem' }} className="text-gold">
          MATCH_METADATA
        </h3>
        <span className="subtitle" style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>
          // Optional pre-OCR fields. Patch + winner recommended.
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="review-input-group">
              <label>PATCH</label>
              <input
                type="text"
                value={metadata.patch}
                onChange={e => updateField('patch', e.target.value)}
                placeholder="e.g. 1.9.42"
                autoComplete="off"
              />
            </div>
            <div className="review-input-group">
              <label>WINNING_SIDE</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="winning_side"
                    value="blue"
                    checked={metadata.winning_side === 'blue'}
                    onChange={() => updateField('winning_side', 'blue')}
                  />
                  <span className="text-blue">Blue</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="winning_side"
                    value="red"
                    checked={metadata.winning_side === 'red'}
                    onChange={() => updateField('winning_side', 'red')}
                  />
                  <span className="text-red">Red</span>
                </label>
              </div>
            </div>
            <div className="review-input-group">
              <label>BAN_MODE</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="ban_mode"
                    checked={metadata.ban_mode === 6}
                    onChange={() => handleBanModeChange(6)}
                  />
                  6-ban
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="ban_mode"
                    checked={metadata.ban_mode === 10}
                    onChange={() => handleBanModeChange(10)}
                  />
                  10-ban
                </label>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', opacity: 0.7 }}>BANS (draft order, optional)</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.5rem', marginTop: '0.5rem',
            }}>
              {Array.from({ length: banSlots }, (_, i) => (
                <div key={i} className="review-input-group">
                  <label style={{ fontSize: '0.7rem' }}>{banLabel(i)}</label>
                  <input
                    list={`ban-hero-list-${i}`}
                    value={metadata.bans[i] || ''}
                    onChange={e => updateBan(i, e.target.value)}
                    placeholder="Hero"
                    autoComplete="off"
                  />
                  <datalist id={`ban-hero-list-${i}`}>
                    {HEROES.map(h => <option key={h} value={h} />)}
                  </datalist>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MatchMetadataForm.jsx
git commit -m "feat(metadata): add MatchMetadataForm pre-OCR panel"
```

---

## Task 12: Wire `MatchMetadataForm` into `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports**

Near the existing imports at the top of `src/App.jsx`, add:

```jsx
import MatchMetadataForm, { makeDefaultMetadata } from './components/MatchMetadataForm';
```

- [ ] **Step 2: Add state for match metadata**

Inside the `App()` function, near the other `useState` declarations (around the existing `playerIGNs` state), add:

```jsx
const [matchMetadata, setMatchMetadata] = useState(makeDefaultMetadata());
```

- [ ] **Step 3: Render the form above the gallery**

Find the JSX where the upload/gallery section starts. Add the form just above it. Search for the section that renders the `<input type="file">` upload control and place the metadata form immediately above that section's wrapping element:

```jsx
<MatchMetadataForm
  metadata={matchMetadata}
  onChange={setMatchMetadata}
/>
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`. The metadata form should appear above the gallery with patch input, winning-side radios, ban-mode toggle, and 6 ban dropdowns by default. Toggling to 10-ban should expand to 10 ban slots; toggling back with bans entered in slots 7–10 should prompt the discard confirm.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): wire MatchMetadataForm above gallery"
```

---

## Task 13: Wire `playerAssignments` state through `ReviewModal`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `playerAssignments` state**

In `App()`, near the other state declarations:

```jsx
const [playerAssignments, setPlayerAssignments] = useState({});
```

- [ ] **Step 2: Pass props into `<ReviewModal>`**

Find the JSX where `<ReviewModal>` is rendered. Update the props from:

```jsx
<ReviewModal
  data={reviewData}
  onConfirm={handleReviewConfirm}
  onCancel={handleReviewCancel}
/>
```

to:

```jsx
<ReviewModal
  data={reviewData}
  playerAssignments={playerAssignments}
  onAssignmentsChange={setPlayerAssignments}
  onConfirm={handleReviewConfirm}
  onCancel={handleReviewCancel}
/>
```

- [ ] **Step 3: Reset `playerAssignments` when starting a new match**

Find the function that resets state for a new match (after a row is saved, or when the user uploads new images). It typically resets `setReviewData(null)`. Add `setPlayerAssignments({})` alongside.

If no such reset exists, add it inside `handleReviewConfirm` AFTER the row is saved to `savedRows`:

```jsx
setPlayerAssignments({});
setMatchMetadata(makeDefaultMetadata());
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`. Upload a screenshot, run OCR. The review modal should show 10 hero/role rows. Fill them in. Confirm. Then start another match — both metadata form and player assignments should be reset to defaults.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): wire playerAssignments + metadata reset between matches"
```

---

## Task 14: Bundle metadata + assignments into saved rows; parse duration

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import `parseDuration`**

Add to the imports at top of `src/App.jsx`:

```jsx
import { parseDuration } from './utils/parseDuration';
```

- [ ] **Step 2: Update `handleReviewConfirm` to bundle metadata + assignments**

Find the existing `handleReviewConfirm` function. It currently saves OCR'd data into `savedRows`. Replace its row-construction block so the saved row carries the full match-level shape:

The exact replacement depends on the current structure of `savedRows`. After the existing logic builds the per-player data array, add a `metadata` field to the saved row entry. Conceptually:

```jsx
const handleReviewConfirm = (editedData) => {
  // ... existing logic that builds the per-player OCR data array ...
  // (keep this unchanged)

  // After existing data is assembled, also extract duration from OCR
  const durationRaw = editedData['duration']; // header box id from BASE_PRESETS.main
  const durationSeconds = parseDuration(durationRaw);

  const newRow = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleTimeString(),
    columns: boxes,           // existing
    data: playersData,        // existing per-player OCR results array
    metadata: {
      ...matchMetadata,
      duration: durationSeconds,
    },
    assignments: playerAssignments, // {[player_index]: {hero, role}}
  };

  setSavedRows(prev => [...prev, newRow]);
  setReviewData(null);
  setPlayerAssignments({});
  setMatchMetadata(makeDefaultMetadata());
};
```

If your existing `handleReviewConfirm` builds the row differently, adapt accordingly — the goal is that `newRow.metadata` and `newRow.assignments` are populated when the row is saved.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, complete a full flow (upload → fill metadata → OCR → fill hero/role → confirm). Use browser devtools React inspector to confirm the saved row in `savedRows` state contains both `metadata` and `assignments` fields.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): bundle metadata + assignments + parsed duration into saved rows"
```

---

## Task 15: Replace `DataTable` export with format-toggle modal

**Files:**
- Modify: `src/components/DataTable.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import React, { useState } from 'react';
import { Copy, Download, X } from 'lucide-react';
import { exportLongCSV, exportWideCSV } from '../utils/exportCSV';
import { ROLES } from '../constants/mlbbRoles';

function buildMatchObject(savedRow) {
  const { data: players, metadata, assignments, timestamp } = savedRow;

  const matchTopLevel = {
    battle_id: savedRow.battleId || '',
    match_timestamp: timestamp || '',
    patch: metadata?.patch || '',
    duration: metadata?.duration ?? '',
    winning_side: metadata?.winning_side || '',
    ban_mode: metadata?.ban_mode || 6,
  };

  // Map bans (alternating draft order: even idx = blue, odd = red) to side-prefixed columns
  const banSlots = metadata?.ban_mode === 10 ? 5 : 3;
  for (let i = 1; i <= 5; i++) {
    matchTopLevel[`blue_ban_${i}`] = '';
    matchTopLevel[`red_ban_${i}`] = '';
  }
  if (metadata?.bans) {
    let blueCount = 0;
    let redCount = 0;
    metadata.bans.forEach((hero, idx) => {
      const side = idx % 2 === 0 ? 'blue' : 'red';
      const slotIdx = side === 'blue' ? ++blueCount : ++redCount;
      if (slotIdx > banSlots) return;
      matchTopLevel[`${side}_ban_${slotIdx}`] = hero || '';
    });
  }

  const playersWithMeta = players.map(p => {
    const idx = p.playerIndex;
    return {
      player_index: idx,
      side: idx <= 5 ? 'blue' : 'red',
      role: assignments?.[idx]?.role || '',
      ign: p.ign || '',
      hero: assignments?.[idx]?.hero || '',
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gold: p.gold,
      rating: p.rating,
      hero_dmg: p.hero_dmg,
      consec_kills: p.consec_kills,
      teamfight_pct: p.teamfight,
      crowd_control: p.cc,
      healing_shields: p.healing,
      dmg_taken: p.dmg_taken,
      hero_dmg_overall: p.hero_dmg_ov,
      turret_dmg: p.turret_dmg,
      dmg_taken_overall: p.dmg_taken_ov,
      teamfight_pct_overall: p.teamfight_ov,
      total_gold: p.total_gold,
      jungle_gold: p.jungle_gold,
      kill_gold: p.kill_gold,
      minion_gold: p.minion_gold,
    };
  });

  return { ...matchTopLevel, players: playersWithMeta };
}

export default function DataTable({ rows }) {
  const [exportPickerOpen, setExportPickerOpen] = useState(false);

  if (!rows || rows.length === 0) return null;

  const downloadCSV = (format) => {
    const matches = rows.map(buildMatchObject);
    const serializer = format === 'wide' ? exportWideCSV : exportLongCSV;

    let csv;
    if (format === 'long') {
      // Long: 1 header + (10 * N matches) data rows
      const header = serializer(matches[0]).split('\n')[0];
      const allDataRows = matches.flatMap(m => serializer(m).split('\n').slice(1));
      csv = [header, ...allDataRows].join('\n');
    } else {
      // Wide: 1 header + N data rows
      const header = serializer(matches[0]).split('\n')[0];
      const allDataRows = matches.map(m => serializer(m).split('\n')[1]);
      csv = [header, ...allDataRows].join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlbb_${format}_${new Date().getTime()}.csv`;
    a.click();
    setExportPickerOpen(false);
  };

  const copyToClipboard = (matchId) => {
    const match = rows.find(r => r.id === matchId);
    if (!match) return;
    const matchObj = buildMatchObject(match);
    const csv = exportLongCSV(matchObj);
    // Convert CSV to TSV for clipboard
    const tsv = csv.split('\n').map(line => {
      // naive CSV→TSV; assumes no commas in values (we already CSV-escape elsewhere)
      return line.replace(/,/g, '\t');
    }).join('\n');
    navigator.clipboard.writeText(tsv);
  };

  return (
    <div className="data-table-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <span className="subtitle" style={{ fontSize: '0.75rem' }}>
          // {rows.length} MATCH_RECORDS_INITIALIZED (10_SLOT_EXTRACTION)
        </span>
        <button className="btn btn-cyan" onClick={() => setExportPickerOpen(true)}>
          <Download size={16} /> EXPORT_CSV
        </button>
      </div>

      {exportPickerOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }}>
            <header className="modal-header">
              <h2 className="text-gold">EXPORT_FORMAT</h2>
              <button className="btn-icon" onClick={() => setExportPickerOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <p className="subtitle">// Choose CSV shape for your downstream pipeline.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn btn-cyan"
                style={{ flex: 1 }}
                onClick={() => downloadCSV('long')}
              >
                LONG (10 rows/match)
              </button>
              <button
                className="btn btn-cyan"
                style={{ flex: 1 }}
                onClick={() => downloadCSV('wide')}
              >
                WIDE (1 row/match)
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.map((match, i) => (
        <div key={match.id} className="glass-panel" style={{ marginBottom: '3rem' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem',
          }}>
            <h4 style={{ color: 'var(--color-gold-glow)', fontWeight: 'bold', margin: 0, fontSize: '1rem' }}>
              MATCH_ID: {i + 1}
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: '1rem' }}>
                [{match.timestamp}]
              </span>
            </h4>
            <button
              className="btn"
              onClick={() => copyToClipboard(match.id)}
              title="Copy Match Data (Tab-Separated, long format)"
            >
              <Copy size={14} /> COPY_BUFFER
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>P#</th>
                  <th>SIDE</th>
                  <th>ROLE</th>
                  <th>IGN</th>
                  <th>HERO</th>
                </tr>
              </thead>
              <tbody>
                {match.data.map(player => {
                  const idx = player.playerIndex;
                  return (
                    <tr key={idx}>
                      <td style={{ color: 'var(--color-mlbb-blue)', fontWeight: 'bold' }}>{idx}</td>
                      <td>{idx <= 5 ? 'blue' : 'red'}</td>
                      <td>{match.assignments?.[idx]?.role || '-'}</td>
                      <td style={{ fontWeight: '600' }}>{player.ign || '-'}</td>
                      <td>{match.assignments?.[idx]?.hero || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Note on the `buildMatchObject` translation: the existing OCR pipeline names player stat fields differently from the new schema (e.g., `teamfight` → `teamfight_pct`, `cc` → `crowd_control`, `healing` → `healing_shields`, `hero_dmg_ov` → `hero_dmg_overall`, `dmg_taken_ov` → `dmg_taken_overall`, `teamfight_ov` → `teamfight_pct_overall`). The mapping in `buildMatchObject` translates legacy field names to schema names. If the existing OCR field IDs in `BASE_PRESETS` differ from what's mapped here, adjust the right-hand side of each mapping accordingly.

- [ ] **Step 2: Manually verify**

Run `npm run dev`. Complete a full flow with at least one match saved. Click EXPORT_CSV. Modal should offer Long / Wide. Click Long → CSV downloads with 1 + 10*N rows. Click Wide → CSV downloads with 1 + N rows. Open both in a spreadsheet; long should have 40 columns, wide 226.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataTable.jsx
git commit -m "feat(export): replace ad-hoc CSV with long/wide format toggle"
```

---

## Task 16: End-to-end manual verification (Tier 1 smoke checklist)

**Files:** none (verification only)

This task does not produce a commit. Run through the Tier 1 manual smoke checklist from `docs/superpowers/specs/2026-05-02-pro-team-data-expansion-design.md` Section 9.

- [ ] **Step 1: Full happy-path export**

Upload a complete batch (all 5 tabs of the same match) → fill metadata form (patch, winner, 6 bans) → run OCR → assign all 10 hero+role pairs → click EXPORT_CSV → choose Long. Open downloaded CSV. Assert:
- Exactly 11 lines (header + 10 player rows)
- Header has 40 columns
- All 10 rows have `BID*` battle_id, the `patch` value, the `duration` integer, `winning_side` matching the radio choice
- Bans for blue side appear in `blue_ban_1/2/3`; red in `red_ban_1/2/3`; `*_ban_4/5` are blank

Repeat for Wide. Assert:
- Exactly 2 lines
- Header has 226 columns
- Slot order: `blue_exp_*`, `blue_jungle_*`, `blue_mid_*`, `blue_roam_*`, `blue_gold_*`, `red_exp_*`, ..., `red_gold_minion_gold`

- [ ] **Step 2: Blocking validation triggers**

In the review modal, leave one hero blank → confirm button is disabled with tooltip naming the missing player.
Tag two Blue-side players with role `mid` → red error border on those dropdowns + banner shows "Blue side has 2x mid".

- [ ] **Step 3: Warning validation triggers**

Leave `patch` blank, fill everything else, click EXPORT_CSV → confirm dialog appears with patch warning. Confirm `Continue` proceeds with export.

- [ ] **Step 4: 6-ban ↔ 10-ban toggle**

Fill all 6 bans in 6-ban mode → toggle to 10-ban → first 6 are preserved, slots 7–10 are blank. Type into slot 8 → toggle back to 6-ban → confirm dialog warns about discarding; choose Continue → slot 8 value is gone.

- [ ] **Step 5: Partial tab upload**

Upload only the Main tab → fill hero/role for all 10 → export Wide. All `*_hero_dmg`, `*_consec_kills`, `*_teamfight_pct`, `*_total_gold` etc. (DPS/Team/Overall/Farm fields) should be blank for all 10 slots. Battle_id, duration, patch, ban metadata should be present.

- [ ] **Step 6: DPS red-side column-swap fix verification**

Re-run OCR on the same DPS-tab screenshot used in the existing sample CSV (`mlbb_batch_stats_1777486564981.csv`). Inspect red-side `hero_dmg` values: they should now be 5-digit numbers (was: 1-2). Inspect red-side `consec_kills`: should be small integers (was: 5-digit).

- [ ] **Step 7: Run the full automated test suite once more**

```bash
npm test
```

Expected: all tests pass (parseDuration: 8, validateRoster: 7, exportCSV: 17 = **32 passed**).

If the smoke checklist passes end-to-end, the feature is complete.
