export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'bad_request', message, details);
}
export function unauthorized(message = 'unauthorized'): AppError {
  return new AppError(401, 'unauthorized', message);
}
export function forbidden(message = 'forbidden'): AppError {
  return new AppError(403, 'forbidden', message);
}
export function notFound(message = 'not found'): AppError {
  return new AppError(404, 'not_found', message);
}
export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, 'conflict', message, details);
}
export function setupRequired(): AppError {
  return new AppError(503, 'setup_required', 'setup is required before this endpoint is available');
}
export function tooMany(message = 'too many requests'): AppError {
  return new AppError(429, 'too_many_requests', message);
}