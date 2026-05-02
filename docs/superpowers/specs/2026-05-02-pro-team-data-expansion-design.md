# Pro-Team Data Expansion — Design Spec

**Date:** 2026-05-02
**Author:** Aedwon (with brainstorm assistance)
**Status:** Approved for plan-out

## 1. Context & Goal

The MLBB Stat Extractor is a proof-of-concept / scaffolding for a larger esports data pipeline consumed by professional team coaches and analysts. Output of this tool is fed into a larger aggregated log of games, drafts, and team data, which is then interpreted by teams for training and opponent prep.

The current tool extracts 22 columns of player stats (KDA, gold, hero damage, etc.) from up to 5 post-game screenshot tabs and exports as CSV with one row per player (10 rows per match). It captures **no match-level metadata** — no patch, no heroes, no draft info, no winner, no duration.

This expansion adds the data fields a serious team would need to ingest match data into their pipeline.

**Design priority:** schema rigor and pipeline joinability over human-readable output.

## 2. Scope

### In scope

- Manual entry of: game patch, bans (configurable 6-ban or 10-ban mode), winning side, hero per player, role/lane per player.
- OCR addition: match duration (single new bounding box on the Main tab preset).
- New output schema with two formats:
  - **Long format** — one row per player (10 rows per match), with denormalized match metadata.
  - **Wide format** — one row per match, role-positional columns (Blue EXP/Jungle/Mid/Roam/Gold then Red same).
- Snake_case rename of all existing column names.
- Hero typeahead with free-text fallback for forward-compatibility with new heroes.
- Hard validation: 5 distinct roles per side; all 10 heroes assigned before export.
- Soft validation: warning if patch or winning side is unset at export.
- Fix the pre-existing red-side DPS column swap bug (Hero Damage / Consec Kills swap).

### Out of scope (explicit non-goals)

- Image-based hero / item / battle-spell / medal classification.
- Persistence across browser sessions for match metadata or partial review state.
- Match-as-project workflow (saved match list, resume-later, learned role suggestions).
- Wizard-style staged UI.
- Multi-language OCR.
- Match date entry (downstream stamps it).
- Game mode / tournament context labels.
- Team names / tags.
- Per-player items, battle spells, hero level, medal tier, MVP designation (MVP is derivable from rating downstream).
- Team total kills (derivable from sum of player kills).
- Image classification of any kind.

## 3. Output Schema

### 3.1 Naming convention

- All column names in `snake_case`.
- Side prefix: `blue_` / `red_` (full words, not abbreviations).
- Role tokens: `exp`, `jungle`, `mid`, `roam`, `gold`.
- Stat tokens (renamed from existing CSV):

| Existing (TitleCase)    | New (snake_case)         |
|-------------------------|--------------------------|
| Match Timestamp         | `match_timestamp`        |
| Player Index            | `player_index`           |
| Battle ID               | `battle_id`              |
| Kills                   | `kills`                  |
| Deaths                  | `deaths`                 |
| Assists                 | `assists`                |
| Gold                    | `gold`                   |
| Rating                  | `rating`                 |
| Hero Damage             | `hero_dmg`               |
| Consecutive Kills       | `consec_kills`           |
| Teamfight               | `teamfight_pct`          |
| Crowd Control           | `crowd_control`          |
| Healing/Shields         | `healing_shields`        |
| Damage Taken            | `dmg_taken`              |
| Overall Hero Dmg        | `hero_dmg_overall`       |
| Turret Damage           | `turret_dmg`             |
| Overall Dmg Taken       | `dmg_taken_overall`      |
| Overall Teamfight       | `teamfight_pct_overall`  |
| Total Gold              | `total_gold`             |
| Jungle Gold             | `jungle_gold`            |
| Kill Gold               | `kill_gold`              |
| Minion Gold             | `minion_gold`            |

### 3.2 New match-level columns

```
patch              (string, e.g. "1.9.42")
duration           (integer, total seconds, e.g. 598)
winning_side       ("blue" | "red")
ban_mode           (integer: 6 | 10)
blue_ban_1 ... blue_ban_5
red_ban_1 ... red_ban_5
```

In 6-ban mode, only `*_ban_1`, `*_ban_2`, `*_ban_3` are populated; `*_ban_4` and `*_ban_5` remain blank.

### 3.3 New player-level columns

```
side               ("blue" | "red", derived from player_index 1–5 / 6–10)
role               ("gold" | "exp" | "mid" | "jungle" | "roam")
ign                (existing roster autocomplete value)
hero               (manual dropdown value)
```

### 3.4 Long format (10 rows per match, 40 columns)

Column order:

```
battle_id, match_timestamp, patch, duration, winning_side, ban_mode,
blue_ban_1, blue_ban_2, blue_ban_3, blue_ban_4, blue_ban_5,
red_ban_1, red_ban_2, red_ban_3, red_ban_4, red_ban_5,
player_index, side, role, ign, hero,
kills, deaths, assists, gold, rating,
hero_dmg, consec_kills,
teamfight_pct, crowd_control, healing_shields, dmg_taken,
hero_dmg_overall, turret_dmg, dmg_taken_overall, teamfight_pct_overall,
total_gold, jungle_gold, kill_gold, minion_gold
```

Match-level columns (`battle_id` through `red_ban_5`) are denormalized — same value across all 10 rows for a given match.

### 3.5 Wide format (1 row per match, 226 columns)

Match-level columns identical to long format (16 columns).

Per-slot columns: 10 slots in role-position order — Blue side first, then Red side. Within each side: EXP, Jungle, Mid, Roam, Gold. For each slot:

```
{side}_{role}_ign,
{side}_{role}_hero,
{side}_{role}_kills, {side}_{role}_deaths, {side}_{role}_assists,
{side}_{role}_gold, {side}_{role}_rating,
{side}_{role}_hero_dmg, {side}_{role}_consec_kills,
{side}_{role}_teamfight_pct, {side}_{role}_crowd_control,
{side}_{role}_healing_shields, {side}_{role}_dmg_taken,
{side}_{role}_hero_dmg_overall, {side}_{role}_turret_dmg,
{side}_{role}_dmg_taken_overall, {side}_{role}_teamfight_pct_overall,
{side}_{role}_total_gold, {side}_{role}_jungle_gold,
{side}_{role}_kill_gold, {side}_{role}_minion_gold
```

21 columns × 10 slots = 210 player columns + 16 match columns = **226 total**.

Slot order: `blue_exp_*`, `blue_jungle_*`, `blue_mid_*`, `blue_roam_*`, `blue_gold_*`, `red_exp_*`, `red_jungle_*`, `red_mid_*`, `red_roam_*`, `red_gold_*`.

## 4. Manual Input UX

### 4.1 Pre-OCR form: `MatchMetadataForm`

A new collapsible panel above the existing gallery in `App.jsx`. Three groups of fields:

**Match info**
- `patch` — text input, free-form. Recommended; export-time warning if blank.
- `winning_side` — radio buttons: Blue / Red. Recommended; export-time warning if blank.

**Bans**
- `ban_mode` — radio: `6-ban (3 per side)` / `10-ban (5 per side)`. Defaults to `6-ban`.
- 6 or 10 hero typeahead dropdowns, labeled in MLBB draft order:
  - 6-ban: Ban 1 (Blue), Ban 2 (Red), Ban 3 (Blue), Ban 4 (Red), Ban 5 (Blue), Ban 6 (Red)
  - 10-ban: same alternating pattern up to Ban 10
- Fully optional. No warning if blank.
- Hero typeahead pulls from `mlbbHeroes.js` static list, with free-text fallback.

The form persists nowhere — refresh resets it. Documented limitation.

### 4.2 Post-OCR review modal extension

The existing `ReviewModal.jsx` shows OCR'd cell values for verification. Extended with two new column groups per player row, placed at the **left** of each row (before the OCR'd stat columns):

- `hero` — typeahead from `mlbbHeroes.js`, free-text fallback.
- `role` — fixed 5-option select: Gold, EXP, Mid, Jungle, Roam.

Real-time validation:
- Role duplicate within a side → red border + tooltip: `"Blue side has 2x Mid — must be 5 distinct roles."`
- Export button disabled while any role conflict exists or any of the 10 hero/role fields is unset.
- Warning banner at top if `patch` or `winning_side` is blank: `"Patch not set — proceed anyway?"`

### 4.3 Export flow

Sequenced steps:

1. Validation runs continuously in the review modal. While any blocking rule fails (role collision, missing hero, etc.), the Export button stays disabled with a tooltip explaining what's wrong.
2. Once validation passes, the Export button enables.
3. User clicks Export → format-choice modal appears with two options:
   - `Long (per-player)` — emits the 10-row CSV.
   - `Wide (per-match)` — emits the 1-row CSV.
4. If `patch` or `winning_side` is unset, a warning confirm dialog appears: `"Patch not set, winning side not set. Continue export?"` with `Continue` / `Cancel`.
5. On confirm, CSV serializes and downloads. Existing `localStorage` IGN history update behavior unchanged.

### 4.4 Data flow

```
[1] Page load
      ↓
[2] User fills MatchMetadataForm (optional now, can fill later)
      ↓
[3] User uploads screenshots → tab-mapping → BattleID verify → OCR (unchanged)
      ↓
[4] ReviewModal opens with OCR'd stats + 10 (hero, role) dropdowns
      ↓
[5] User assigns hero + role per player; validation runs continuously
      ↓
[6] User clicks Export → format toggle modal: Long / Wide
      ↓
[7] CSV serialized + downloaded
```

## 5. OCR Addition: Match Duration

A new bounding box on the Main tab preset for the duration text (top-right of the post-game screen, e.g., `09:58`).

- Box id: `duration`, type: `header` (single-value, not column-sliced — same pattern as `battle_id`).
- Default coordinates: `x: 1700, y: 100, width: 200, height: 50` (analyst fine-tunes once; saved to localStorage like other preset edits).
- Parser: trim input, then match against anchored regex `/^(\d{1,2}):(\d{2})$/` → emit total seconds as integer (e.g., `598`). Anchoring rejects malformed OCR output (extra characters, multiple colons).
- Failure mode: blank if regex fails; non-blocking.

No other OCR changes. Existing 5 tabs and column slicers are untouched.

## 6. Validation Rules

| Rule | Trigger | Severity |
|---|---|---|
| Each side must have 5 distinct roles | Review modal, real-time | Blocking — export disabled |
| All 10 players must have a hero | Review modal, real-time | Blocking |
| BattleID matches across uploaded screenshots (existing) | Pre-OCR | Blocking (existing behavior) |
| `patch` is set | Export click | Warning — confirm dialog |
| `winning_side` is set | Export click | Warning — confirm dialog |
| Bans entered | Export click | None — fully optional |
| `duration` OCR'd successfully | Export click | None — fully optional |
| Ban count matches `ban_mode` | Ban-form blur | Soft hint, not blocking |

## 7. Edge Cases & Handling

- **Partial tab uploads**: stat columns for missing tabs are blank; new fields populated normally; both CSV formats handle nulls cleanly.
- **`ban_mode` toggle with bans entered**:
  - 6→10: preserve entered bans in slots 1–6; slots 7–10 blank.
  - 10→6: discard slots 7–10 with one-line warning `"Slots 7–10 will be discarded"`.
- **Hero list staleness** (new hero released): typeahead allows free-text fallback with `"Use \"<typed value>\" as-is?"` confirmation.
- **DPS red-side column swap (pre-existing bug)**: in the existing sample export (`mlbb_batch_stats_1777486564981.csv`), red-side rows for the DPS tab show implausible values — `hero_dmg` = small integers (1–2) and `consec_kills` = 5-digit numbers — which is the inverse of the correct mapping. Root cause: `RED_COLUMN_ORDER` in `App.jsx` has no entry for `dps`, so the OCR slicer assumes red-side column order matches blue-side, but the red side actually renders columns in reverse visual order on this tab. Fix: add `dps: ['consec_kills', 'hero_dmg']` to `RED_COLUMN_ORDER`. The implementation plan must verify this order by inspecting an actual DPS-tab screenshot before committing the fix; if the visual order on the red side differs, swap the array values accordingly.
- **Browser refresh during entry**: progress is lost. Documented as a known limitation; future fix tracked under deferred Approach 3 work.

## 8. Component Map

| File | Status | Purpose |
|---|---|---|
| `src/components/MatchMetadataForm.jsx` | NEW | Pre-OCR form (patch, bans, winner) |
| `src/components/ReviewModal.jsx` | MODIFIED | Add hero/role dropdowns + validation |
| `src/components/DataTable.jsx` | MODIFIED | Add long/wide format toggle on export |
| `src/constants/mlbbHeroes.js` | NEW | Static hero list (~120+ heroes) |
| `src/constants/mlbbRoles.js` | NEW | The 5 role tokens |
| `src/utils/exportCSV.js` | NEW | Long + wide format serializers |
| `src/utils/parseDuration.js` | NEW | OCR duration parser |
| `src/utils/validateRoster.js` | NEW | Role uniqueness + completeness validator |
| `src/App.jsx` | MODIFIED | Wire MatchMetadataForm; pass match metadata into export; add duration box to Main preset; fix DPS red-side column order |

## 9. Testing Strategy

**Framework: Vitest** — chosen for native Vite integration, ESM support, Jest-compatible API, ~3× faster than Jest.

### Tier 1 — Unit tests on pure functions

Located in `src/utils/__tests__/` alongside the modules they test:

- `exportCSV.test.js` — given a fixed match object, assert exact column count and column order for both long and wide outputs. Cover: full match, partial match (missing tabs), 6-ban vs 10-ban, blank patch.
- `validateRoster.test.js` — given a player array, assert pass/fail for: clean roster, role collision, missing hero, missing role.
- `parseDuration.test.js` — assert correct seconds output for: `"09:58"` → 598, `"1:23"` → 83, `""` → null, `"abc"` → null, `"12:34:56"` → null (rejected — not expected format).

### Tier 2 — Manual smoke checklist (run on every release)

1. Upload sample batch → fill metadata form → run OCR → assign all 10 roles+heroes → export both formats. Verify column counts: long ≈ 36, wide ≈ 226.
2. Trigger every blocking validation (role collision, missing hero) — confirm export disabled.
3. Trigger every warning (no patch, no winner) — confirm dialog appears.
4. Toggle 6-ban ↔ 10-ban with bans entered; verify preservation/clearing.
5. Upload only Main tab; verify stat columns for missing tabs are blank.
6. Verify DPS red-side column-swap fix on the known sample (`mlbb_batch_stats_1777486564981.csv`).

## 10. Implementation Order

Slices are ordered to deliver verifiable value at each step.

1. **Schema + serializers + Vitest setup.** Build `exportCSV.js` (long + wide), `validateRoster.js`, `parseDuration.js`. Wire Vitest. Test against hand-crafted match objects. Output: hardcoded match exports correctly.
2. **Hero + role dropdowns in `ReviewModal`.** Wire validation. Use existing OCR output + new serializer end-to-end.
3. **`MatchMetadataForm`** (pre-OCR panel). Patch + winner radio + ban mode + ban dropdowns. Wire to export.
4. **`duration` OCR box** added to Main preset; parser; integration into match metadata.
5. **DPS red-side column-swap fix** in `RED_COLUMN_ORDER`.
6. **Long/Wide format toggle modal** on export click.
7. **End-to-end manual verification** (Tier 1 checklist).

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hero list goes stale when MLBB releases new heroes | Free-text fallback in typeahead with confirm dialog |
| 226-column wide CSV intimidates a curious user opening it in Excel | Document pipeline-first intent in README |
| User mis-assigns role and exports → bad data downstream | Hard validation (5 distinct roles per side) catches this |
| User loses progress on browser refresh | Documented limitation; future fix via deferred Approach 3 |
| DPS column-swap fix breaks existing users with cached presets | Fix is in code constant `RED_COLUMN_ORDER`, not in localStorage; no migration |
