const DEFAULT_PROFILE = {
  kind: 'integer',
  whitelist: '0123456789',
  min: 0,
  max: 9_999_999,
  minConfidence: 84,
  psm: '8',
};

const FIELD_PROFILES = {
  battle_id: {
    kind: 'id',
    whitelist: '0123456789',
    minDigits: 12,
    maxDigits: 24,
    preferredDigits: 18,
    minConfidence: 90,
    psm: '7',
  },
  duration: {
    kind: 'duration',
    whitelist: '0123456789:./',
    minConfidence: 86,
    psm: '7',
  },
  kills: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99, minConfidence: 86, psm: '8' },
  deaths: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99, minConfidence: 86, psm: '8' },
  assists: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99, minConfidence: 86, psm: '8' },
  consec_kills: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99, minConfidence: 86, psm: '8' },
  gold: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99_999, minConfidence: 84, psm: '8' },
  total_gold: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99_999, minConfidence: 84, psm: '8' },
  jungle_gold: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99_999, minConfidence: 84, psm: '8' },
  kill_gold: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99_999, minConfidence: 84, psm: '8' },
  minion_gold: { kind: 'integer', whitelist: '0123456789', min: 0, max: 99_999, minConfidence: 84, psm: '8' },
  rating: {
    kind: 'rating',
    whitelist: '0123456789.,/',
    min: 0,
    max: 30,
    minConfidence: 88,
    psm: '8',
  },
  teamfight: {
    kind: 'percent',
    whitelist: '0123456789%',
    min: 0,
    max: 100,
    minConfidence: 86,
    psm: '8',
  },
  teamfight_ov: {
    kind: 'percent',
    whitelist: '0123456789%',
    min: 0,
    max: 100,
    minConfidence: 86,
    psm: '8',
  },
};

function baseFieldId(fieldId = '') {
  return String(fieldId).replace(/_red$/, '');
}

export function getOCRProfile(fieldId) {
  return { ...DEFAULT_PROFILE, ...(FIELD_PROFILES[baseFieldId(fieldId)] || {}) };
}

function mapCommonOCRConfusions(value) {
  return value
    .replace(/[OoQq]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');
}

function normalizeDuration(value) {
  let cleaned = value
    .replace(/\s+/g, '')
    .replace(/[.;,/\\]+/g, ':')
    .replace(/[^0-9:]/g, '')
    .replace(/:+/g, ':')
    .replace(/^:|:$/g, '');

  if (!cleaned.includes(':') && /^\d{3,4}$/.test(cleaned)) {
    cleaned = `${cleaned.slice(0, -2)}:${cleaned.slice(-2)}`;
  }

  return cleaned;
}

function normalizeRating(value) {
  let cleaned = value
    .replace(/\s+/g, '')
    .replace(/[,/:\\]+/g, '.')
    .replace(/[^0-9.]/g, '')
    .replace(/\.{2,}/g, '.');

  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }

  // MLBB ratings are normally shown with one decimal. If Tesseract drops only
  // the decimal point (e.g. 83 -> 8.3 or 120 -> 12.0), recover it when the
  // integer interpretation would be outside the plausible rating range.
  if (!cleaned.includes('.') && /^\d{2,3}$/.test(cleaned)) {
    const integerValue = Number(cleaned);
    if (cleaned.length === 3 || integerValue > 30) {
      cleaned = `${cleaned.slice(0, -1)}.${cleaned.slice(-1)}`;
    }
  }

  return cleaned;
}

export function normalizeOCRText(rawText, fieldId) {
  const profile = getOCRProfile(fieldId);
  const mapped = mapCommonOCRConfusions(String(rawText ?? '').normalize('NFKC'));

  switch (profile.kind) {
    case 'duration':
      return normalizeDuration(mapped);
    case 'rating':
      return normalizeRating(mapped);
    case 'percent': {
      const digits = mapped.replace(/[^0-9]/g, '');
      return digits ? `${digits}%` : '';
    }
    case 'id':
    case 'integer':
    default:
      return mapped.replace(/[^0-9]/g, '');
  }
}

export function validateOCRValue(value, fieldId) {
  const profile = getOCRProfile(fieldId);
  const normalized = normalizeOCRText(value, fieldId);

  if (!normalized) return false;

  if (profile.kind === 'id') {
    return /^\d+$/.test(normalized)
      && normalized.length >= profile.minDigits
      && normalized.length <= profile.maxDigits;
  }

  if (profile.kind === 'duration') {
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    return minutes >= 0 && minutes <= 99 && seconds >= 0 && seconds < 60;
  }

  if (profile.kind === 'percent') {
    const match = normalized.match(/^(\d{1,3})%$/);
    if (!match) return false;
    const numericValue = Number(match[1]);
    return numericValue >= profile.min && numericValue <= profile.max;
  }

  if (profile.kind === 'rating') {
    if (!/^\d{1,2}(?:\.\d)?$/.test(normalized)) return false;
    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) && numericValue >= profile.min && numericValue <= profile.max;
  }

  if (!/^\d+$/.test(normalized)) return false;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue >= profile.min && numericValue <= profile.max;
}

function hasExpectedPunctuation(rawText, fieldId) {
  const profile = getOCRProfile(fieldId);
  const raw = String(rawText ?? '');
  if (profile.kind === 'duration') return /[:./]/.test(raw);
  if (profile.kind === 'rating') return /[.,/]/.test(raw);
  if (profile.kind === 'percent') return /%/.test(raw);
  return true;
}

export function scoreOCRCandidate(candidate, fieldId) {
  const normalized = normalizeOCRText(candidate?.text, fieldId);
  const confidence = Number.isFinite(candidate?.confidence) ? candidate.confidence : 0;
  const profile = getOCRProfile(fieldId);
  const valid = validateOCRValue(normalized, fieldId);

  let score = confidence;
  score += valid ? 40 : -80;
  if (normalized) score += 5;
  if (hasExpectedPunctuation(candidate?.text, fieldId)) score += 4;

  if (profile.kind === 'id' && normalized.length === profile.preferredDigits) score += 10;
  if (profile.kind === 'rating' && normalized.includes('.')) score += 6;
  if (profile.kind === 'duration' && normalized.includes(':')) score += 6;

  return { ...candidate, text: normalized, valid, score };
}

export function shouldRetryOCRCandidate(candidate, fieldId) {
  const scored = scoreOCRCandidate(candidate, fieldId);
  const profile = getOCRProfile(fieldId);
  if (!scored.valid || scored.confidence < profile.minConfidence) return true;

  const raw = String(candidate?.text ?? '');
  if (profile.kind === 'id' && scored.text.length !== profile.preferredDigits) return true;
  if ((profile.kind === 'duration' || profile.kind === 'rating') && !hasExpectedPunctuation(raw, fieldId)) return true;

  return false;
}

export function selectBestOCRCandidate(candidates, fieldId) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { text: '', confidence: 0, valid: false, score: -Infinity };
  }

  return candidates
    .map(candidate => scoreOCRCandidate(candidate, fieldId))
    .sort((a, b) => b.score - a.score)[0];
}

function percentileFromHistogram(histogram, total, percentile) {
  const target = total * percentile;
  let cumulative = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    cumulative += histogram[i];
    if (cumulative >= target) return i;
  }
  return 255;
}

function otsuThreshold(histogram, total) {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = -1;
  let threshold = 127;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const betweenClassVariance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance;
      threshold = i;
    }
  }

  return threshold;
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function putGrayPixels(canvas, gray) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < gray.length; i += 1) {
    const offset = i * 4;
    const value = gray[i];
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

function dilateBlackPixels(gray, width, height) {
  const output = new Uint8ClampedArray(gray);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (gray[index] === 0) continue;
      let touchesBlack = false;
      for (let dy = -1; dy <= 1 && !touchesBlack; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (gray[(y + dy) * width + (x + dx)] === 0) {
            touchesBlack = true;
            break;
          }
        }
      }
      if (touchesBlack) output[index] = 0;
    }
  }
  return output;
}

export function createOCRCropVariants(image, rect, options = {}) {
  if (typeof document === 'undefined') {
    throw new Error('createOCRCropVariants requires a browser DOM');
  }

  const padding = options.padding ?? 4;
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const sx = Math.max(0, rect.x - padding);
  const sy = Math.max(0, rect.y - padding);
  const right = Math.min(imageWidth, rect.x + rect.width + padding);
  const bottom = Math.min(imageHeight, rect.y + rect.height + padding);
  const sw = Math.max(1, right - sx);
  const sh = Math.max(1, bottom - sy);

  const scale = options.scale ?? Math.max(3, Math.min(5, Math.ceil(120 / sh)));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const sourceCanvas = createCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceCtx.fillStyle = '#fff';
  sourceCtx.fillRect(0, 0, width, height);
  sourceCtx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in sourceCtx) sourceCtx.imageSmoothingQuality = 'high';
  sourceCtx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  const sourceData = sourceCtx.getImageData(0, 0, width, height).data;
  const pixelCount = width * height;
  const gray = new Uint8ClampedArray(pixelCount);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 4;
    const value = Math.round(
      0.2126 * sourceData[offset]
      + 0.7152 * sourceData[offset + 1]
      + 0.0722 * sourceData[offset + 2],
    );
    gray[i] = value;
    histogram[value] += 1;
  }

  const low = percentileFromHistogram(histogram, pixelCount, 0.02);
  const high = percentileFromHistogram(histogram, pixelCount, 0.98);
  const range = Math.max(16, high - low);
  const normalizedGray = new Uint8ClampedArray(pixelCount);
  const normalizedHistogram = new Uint32Array(256);

  for (let i = 0; i < pixelCount; i += 1) {
    const stretched = Math.max(0, Math.min(255, Math.round(((gray[i] - low) * 255) / range)));
    normalizedGray[i] = stretched;
    normalizedHistogram[stretched] += 1;
  }

  const normalizedCanvas = createCanvas(width, height);
  putGrayPixels(normalizedCanvas, normalizedGray);

  const threshold = otsuThreshold(normalizedHistogram, pixelCount);
  const darkPixels = normalizedGray.reduce((count, value) => count + (value <= threshold ? 1 : 0), 0);
  const invert = darkPixels > pixelCount * 0.5;
  const binaryGray = new Uint8ClampedArray(pixelCount);

  for (let i = 0; i < pixelCount; i += 1) {
    const isDark = normalizedGray[i] <= threshold;
    const foreground = invert ? !isDark : isDark;
    binaryGray[i] = foreground ? 0 : 255;
  }

  const binaryCanvas = createCanvas(width, height);
  putGrayPixels(binaryCanvas, binaryGray);

  const dilatedCanvas = createCanvas(width, height);
  putGrayPixels(dilatedCanvas, dilateBlackPixels(binaryGray, width, height));

  return [
    { name: 'normalized', canvas: normalizedCanvas },
    { name: 'binary', canvas: binaryCanvas },
    { name: 'dilated', canvas: dilatedCanvas },
  ];
}

async function recognizeVariant(worker, variant) {
  const { data } = await worker.recognize(variant.canvas.toDataURL('image/png'));
  return {
    variant: variant.name,
    text: data?.text ?? '',
    confidence: Number.isFinite(data?.confidence) ? data.confidence : 0,
  };
}

export async function recognizeNumericField(worker, image, rect, fieldId, options = {}) {
  const profile = getOCRProfile(fieldId);
  const variants = createOCRCropVariants(image, rect, options);

  await worker.setParameters({
    tessedit_char_whitelist: profile.whitelist,
    tessedit_pageseg_mode: profile.psm,
    user_defined_dpi: '300',
  });

  const candidates = [await recognizeVariant(worker, variants[0])];

  if (shouldRetryOCRCandidate(candidates[0], fieldId)) {
    candidates.push(await recognizeVariant(worker, variants[1]));

    const bestAfterBinary = selectBestOCRCandidate(candidates, fieldId);
    if (shouldRetryOCRCandidate(bestAfterBinary, fieldId)) {
      candidates.push(await recognizeVariant(worker, variants[2]));
    }
  }

  const best = selectBestOCRCandidate(candidates, fieldId);
  return {
    ...best,
    candidates,
    previewDataUrl: variants[0].canvas.toDataURL('image/png'),
  };
}
