export function formatDuration(microseconds: number): string {
  if (microseconds < 1000) {
    return `${microseconds.toFixed(0)}μs`;
  }
  if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  }
  return `${(microseconds / 1000000).toFixed(2)}s`;
}

export function formatTimestamp(milliseconds: number): string {
  const date = new Date(milliseconds);
  return date.toLocaleString();
}

