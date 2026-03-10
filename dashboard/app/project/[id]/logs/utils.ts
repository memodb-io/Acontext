/**
 * Format duration from microseconds to human-readable string
 */
export function formatDuration(microseconds: number): string {
  if (microseconds < 1000) {
    return `${microseconds}µs`;
  } else if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  } else {
    return `${(microseconds / 1000000).toFixed(2)}s`;
  }
}

/**
 * Format timestamp (milliseconds) to human-readable date/time string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

