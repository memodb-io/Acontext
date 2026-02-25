/**
 * Custom exceptions raised by the acontext TypeScript client.
 */

/**
 * Base exception for all errors raised by `acontext`.
 */
export class AcontextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AcontextError';
    Object.setPrototypeOf(this, AcontextError.prototype);
  }
}

/**
 * Raised when the server returns an error response.
 */
export class APIError extends AcontextError {
  statusCode: number;
  code?: number;
  message: string;
  error?: string;
  payload?: unknown;

  constructor(options: {
    statusCode: number;
    code?: number;
    message?: string;
    error?: string;
    payload?: unknown;
  }) {
    const details = options.message || options.error || 'API request failed';
    super(`${options.statusCode}: ${details}`);
    this.name = 'APIError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.message = details;
    this.error = options.error;
    this.payload = options.payload;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Raised when the underlying HTTP transport failed before receiving a response.
 */
export class TransportError extends AcontextError {
  constructor(message: string) {
    super(message);
    this.name = 'TransportError';
    Object.setPrototypeOf(this, TransportError.prototype);
  }
}

/**
 * Raised when a polling operation exceeds the configured timeout.
 */
export class TimeoutError extends AcontextError {
  constructor(message: string = 'operation timed out') {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

