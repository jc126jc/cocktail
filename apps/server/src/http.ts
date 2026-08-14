import type { Context } from "hono";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, details);
}

export function unauthorized(message: string): HttpError {
  return new HttpError(401, message);
}

export function conflict(message: string, details?: unknown): HttpError {
  return new HttpError(409, message, details);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

export function serviceUnavailable(message: string): HttpError {
  return new HttpError(503, message);
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: { error: string; details?: unknown };
} {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { error: err.message, details: err.details },
    };
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "Validation failed", details: err.flatten() },
    };
  }
  console.error(err);
  return {
    status: 500,
    body: { error: "Database or server error", details: String(err) },
  };
}

export function handleRoute(fn: (c: Context) => Promise<Response> | Response) {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(
        body,
        status as 400 | 401 | 404 | 409 | 500 | 503,
      );
    }
  };
}
