import { memo } from 'react';

interface ByteMetricsBadgeProps {
  ratePerSecond: number;
  totalBytes: number;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatTotal(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ByteMetricsBadgeInner({ ratePerSecond, totalBytes }: ByteMetricsBadgeProps) {
  return (
    <span className="bt-toolbar__byte-metrics" title="Byte throughput · total bytes received">
      <span className="bt-toolbar__byte-metrics-icon" aria-hidden="true">↕</span>
      <span className="bt-toolbar__byte-metrics-rate">{formatRate(ratePerSecond)}</span>
      <span className="bt-toolbar__byte-metrics-sep" aria-hidden="true">·</span>
      <span className="bt-toolbar__byte-metrics-total">{formatTotal(totalBytes)}</span>
    </span>
  );
}

export const ByteMetricsBadge = memo(ByteMetricsBadgeInner);
