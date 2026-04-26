# MLBB 10-Player Batch Extraction Tasks

- [ ] **Slice 2: The Column Slicer Engine**
  - [ ] Add visual dividers (4 horizontal lines) to bounding boxes to represent the 5 slices.
  - [ ] Update `processOCR` to divide `box.height` by 5.
  - [ ] Run OCR on each of the 5 segments individually.
  - [ ] Map the results to 5 distinct rows (or 10, depending on Left/Right columns).
  - [ ] Verify the math and Tesseract extraction works on a single image.

- [ ] **Slice 1: Batch Upload & Tab Selection UI**
  - [ ] Update `<input type="file">` to `multiple`.
  - [ ] Create a gallery view for uploaded thumbnails.
  - [ ] Add a `select` dropdown for Tab preset to each thumbnail.
  - [ ] Implement duplicate tab validation warning.

- [ ] **Slice 3: Battle ID Extraction & Fuzzy Matching**
  - [ ] Add a dedicated "Battle ID" configuration box on the Main Tab preset.
  - [ ] Create a preliminary OCR pass that only reads the Battle ID box.
  - [ ] Implement Levenshtein distance matching for fuzzy comparison.
  - [ ] Block processing if Battle IDs fail the similarity threshold.

- [ ] **Slice 4: Multi-Image Data Merging & Flexible Export**
  - [ ] Loop OCR processing across all valid uploaded images.
  - [ ] Merge the sliced arrays into a single dataset of 10 players.
  - [ ] Handle missing tabs by injecting nulls/blanks.
  - [ ] Pass the final merged array to `DataTable` for CSV export.
