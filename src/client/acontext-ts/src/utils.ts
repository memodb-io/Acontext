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

/**
 * Validate that a string is a valid UUID (v1–v5) format.
 * @param uuid - The string to validate.
 * @returns True if valid UUID, false otherwise.
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate UUID and throw error if invalid.
 * @param uuid - The UUID to validate.
 * @param paramName - The parameter name for error message.
 * @throws {Error} If UUID is invalid.
 */
export function validateUUID(uuid: string, paramName: string = 'id'): void {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid UUID format for ${paramName}: ${uuid}`);
  }
}

