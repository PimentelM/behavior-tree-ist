export function formatMs(value: number): string {
  if (value < 0.01) return '<0.01ms';
  if (value < 1) return `${value.toFixed(2)}ms`;
  if (value < 100) return `${value.toFixed(1)}ms`;
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

export function formatNowValue(now: number | null, nowIsTimestamp: boolean | null): string | null {
  if (now === null) return null;
  if (!nowIsTimestamp) return `${now}`;

  const timestampMs = Math.abs(now) >= 1e12 ? now : now * 1000;
  const date = new Date(timestampMs);
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  const ss = `${date.getSeconds()}`.padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
