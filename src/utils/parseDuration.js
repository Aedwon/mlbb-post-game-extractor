export function parseDuration(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}
