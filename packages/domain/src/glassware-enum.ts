import type { GlasswareEnumEntry } from "./ingredient-match.js";

/** Canonical glassware labels for import mapping (not a DB table in v1). */
export const DEFAULT_GLASSWARE_ENUM: readonly GlasswareEnumEntry[] = [
  { id: "old_fashioned", label: "Old Fashioned" },
  { id: "rocks", label: "Rocks" },
  { id: "coupe", label: "Coupe" },
  { id: "martini", label: "Martini" },
  { id: "cocktail", label: "Cocktail glass" },
  { id: "highball", label: "Highball" },
  { id: "collins", label: "Collins" },
  { id: "flute", label: "Flute" },
  { id: "wine", label: "Wine glass" },
  { id: "nick_nora", label: "Nick & Nora" },
  { id: "hurricane", label: "Hurricane" },
  { id: "tiki", label: "Tiki mug" },
  { id: "shot", label: "Shot glass" },
];
