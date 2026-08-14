/**
 * Maintained brand → standard ingredient id.
 * Only explicitly listed brands; never inferred by stripping words.
 */
export const DEFAULT_BRAND_ALIASES: Readonly<Record<string, string>> = {
  tanqueray: "london_dry_gin",
  "beefeater london dry": "london_dry_gin",
  beefeater: "london_dry_gin",
  bombay: "london_dry_gin",
  "bombay sapphire": "london_dry_gin",
  hennessy: "cognac",
  "jack daniel's": "bourbon",
  "jack daniels": "bourbon",
  bacardi: "white_rum",
  "captain morgan": "dark_rum",
};
