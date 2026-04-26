# MLBB 10-Player OCR Extractor Architecture

We are shifting the architecture to support extracting data for all 10 players simultaneously across a batch of up to 5 screenshots, merging them into a single comprehensive dataset.

## Goal Description
The app will allow analysts to upload multiple screenshots from a single match, label them by tab, verify they belong to the same match via BattleID, and automatically slice column-based bounding boxes to extract and merge stats for all 10 players perfectly.

## User Review Required

> [!IMPORTANT]
> **Batch Upload UI:** You will now be able to select multiple files at once. The UI will show a thumbnail for each image with a dropdown to select its Tab (Main, DPS, Team, Overall, Farm). Does this sound correct?

> [!WARNING]
> **BattleID Box:** To verify they are all from the same game, the app needs to read the BattleID. We will add a special **"Battle ID Box"** that you configure once. When you click "Process", the app will first read the Battle ID from all uploaded screenshots. If any of them don't match, it will throw an error and abort. Does this work for you?

## Proposed Changes

### 1. Batch Upload & Tab Selection
- Update the file input to accept `multiple` files.
- Display a list of uploaded images with a thumbnail and a `<select>` dropdown to assign a tab preset (Main, DPS, etc.).
- Add validation logic: If the user selects the same tab twice (e.g., two images labeled "DPS"), show a red warning and disable the Process button.

### 2. BattleID Verification
- Add a special configuration box specifically for "Battle ID".
- Before running the full OCR, the app runs a quick OCR pass *just* on the Battle ID box across all selected images.
- **Fuzzy Matching:** It compares the Battle IDs using a similarity threshold (e.g., Levenshtein distance) so that minor OCR errors (like reading 'S' instead of '5') don't falsely fail the check.
- If the Battle IDs are too different across images, display an alert and halt processing.

### 2b. Flexible Processing
- The app handles incomplete batches gracefully. If a user uploads 4 out of 5 tabs (e.g., forgets the Farm tab), the app proceeds and exports the CSV with the missing tab's columns left blank/null for all players.

### 3. Column-Based Bounding Boxes (The Slicer)
- When configuring bounding boxes for a tab, the user draws **"Column Boxes"** (e.g., `Left Kills`, `Right Kills`).
- Update `PRESET_DEFAULTS` to include Left and Right team columns.
- The OCR Engine will divide the `height` of every Column Box by 5.
- It will run Tesseract on each of the 5 segments individually, mapping them to Player 1-5 (Left) and Player 6-10 (Right).

### 4. Data Merging & Export
- Once OCR finishes for all images, the app aggregates the data.
- It uses the Battle ID and Player Index (1-10) as the joining keys.
- It outputs a single DataTable containing exactly 10 rows, where each row contains all the combined stats (Kills, Deaths, Hero Damage, Teamfight %, etc.) pulled from the various tabs.
- The CSV Export will export this massive combined table.

## Verification Plan
1. Build the Batch UI and ensure duplicate tab warnings work.
2. Build the BattleID OCR verification check.
3. Update the slicing logic and test it on a sample column.
4. Verify the final data merge combines the columns correctly into 10 rows.
