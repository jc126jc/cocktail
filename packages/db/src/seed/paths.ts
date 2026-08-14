import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const monorepoRoot = path.resolve(packageRoot, "../..");
export const ibaRoot = path.join(monorepoRoot, "data", "iba");
export const pendingDir = path.join(ibaRoot, "pending");

export function readJson<T>(relativeFromIba: string): T {
  const full = path.join(ibaRoot, relativeFromIba);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

export function writeJson(relativeFromIba: string, value: unknown): string {
  const full = path.join(ibaRoot, relativeFromIba);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2), "utf8");
  return full;
}
