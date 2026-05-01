# MLBB Stat Extractor

A client-side batch extraction terminal designed to convert Mobile Legends: Bang Bang (MLBB) post-game screenshots into structured, exportable data. 

The application uses browser-based OCR to read stat columns from multiple screenshots simultaneously, allowing users to verify the data and export it cleanly to a CSV format for further analysis.

## How It Works

## Technical Architecture Workflow

1. **Image Ingestion**: Screenshots are loaded into the browser's memory and drawn onto a hidden HTML5 `<canvas>` element to standardize their dimensions and allow for programmatic manipulation.
2. **Coordinate Mapping**: The React UI provides an interactive overlay where users define bounding boxes. These boxes generate precise `(x, y, width, height)` coordinates relative to the base image resolution. A symmetry lock function mirrors these coordinates across the center axis to simultaneously map both the Blue and Red team data columns.
3. **Canvas Slicing**: Once coordinates are set, the app iterates through each screenshot, using the Canvas API's `drawImage` method to slice the high-resolution image into dozens of smaller, tightly cropped image blobs corresponding to individual player stats.
4. **WASM OCR Processing**: These cropped blobs are fed into **Tesseract.js** web workers. Because Tesseract runs via WebAssembly, the heavy computational OCR tasks execute concurrently in the background threads of the browser without blocking the main UI thread.
5. **Reconciliation & Export**: The raw text output is sanitized via regex, presented in a React state-managed modal for user review, and finally serialized into an RFC 4180 compliant CSV string for local download.

## Tech Stack

This project is built using a lightweight, zero-backend architecture. All processing happens entirely within the user's browser.

### Core
* **React 18** - UI component architecture and state management
* **Vite** - Build tool and local development server

### Processing
* **Tesseract.js** - WebAssembly-based Optical Character Recognition (OCR) engine for extracting text from images locally
* **HTML5 Canvas API** - Image manipulation, cropping, and bounding box rendering

### Data & State
* **Browser `localStorage`** - Client-side persistence for bounding box presets, onboarding status, and player IGN autocomplete history

### UI & Styling
* **Vanilla CSS** - All styling, grid layouts, and visual effects are written in pure CSS (no preprocessors or utility frameworks)
* **Lucide React** - Vector icon library
* **Google Fonts** - Typography (`Outfit` for body, `Unbounded` for headers, `Spline Sans Mono` for terminal elements)

Created by Aedwon