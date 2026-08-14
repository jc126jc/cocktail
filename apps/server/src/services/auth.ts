import { randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "cocktail_admin_session";
export const DEFAULT_ADMIN_PASSWORD = "cocktail-admin";

const sessions = new Map<string, number>();

export function resolveAdminPassword(override?: string): string {
  if (override !== undefined && override.length > 0) return override;
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_ADMIN_PASSWORD;
}

export function createSessionToken(): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now());
  return token;
}

export function destroySessionToken(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  return sessions.has(token);
}

export function passwordsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    // still compare to avoid trivial timing leak on length alone for short passwords
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Test helper: clear in-memory sessions between suites if needed. */
export function clearSessionsForTests(): void {
  sessions.clear();
}
