/**
 * Utility functions for the acontext TypeScript client.
 */

/**
 * Convert a boolean value to string representation used by the API.
 */
export function boolToStr(value: boolean): string {
  return value ? 'true' : 'false';
}

/**
 * Build query parameters dictionary, filtering None values and converting booleans.
 */
export function buildParams(
  params: Record<string, unknown>
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      if (typeof value === 'boolean') {
        result[key] = boolToStr(value);
      } else {
        result[key] = value as string | number;
      }
    }
  }
  return result;
}

