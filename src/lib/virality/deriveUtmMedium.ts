/**
 * Derives the correct utm_medium value for an L00 mint from the EoA's utm_id.
 *
 * The mint_l00 RPC stores whatever string we pass into both tokens.utm_medium
 * and the embedded utm_medium= query parameter on the full URL. Historically
 * every caller hard-coded "qr", which made every L00 look like a QR scan
 * regardless of channel. This helper centralizes the mapping so the URL
 * truthfully reflects the channel that issued it.
 *
 * Allowed return values match the share/mint allow-list:
 *   qr | em | sms | tx | social | p2p | fb | bs | li | x
 */
export type DerivedUtmMedium =
  | "qr"
  | "em"
  | "sms"
  | "tx"
  | "social"
  | "p2p"
  | "fb"
  | "bs"
  | "li"
  | "x"
  | "refrig";

interface EoaLike {
  utm_id?: string | null;
}

// Exact-match keyword -> canonical medium
const EXACT_MAP: Record<string, DerivedUtmMedium> = {
  email: "em",
  mail: "em",
  em: "em",
  sms: "sms",
  text: "sms",
  tx: "sms",
  qr: "qr",
  qrcode: "qr",
  facebook: "fb",
  fb: "fb",
  twitter: "x",
  x: "x",
  linkedin: "li",
  li: "li",
  bluesky: "bs",
  bs: "bs",
  social: "social",
  p2p: "p2p",
};

// Substring keyword -> canonical medium. Order matters: longer / more specific first.
const SUBSTRING_RULES: Array<[RegExp, DerivedUtmMedium]> = [
  [/email|mail|\bem\b/i, "em"],
  [/sms|text|\btx\b/i, "sms"],
  [/facebook|\bfb\b/i, "fb"],
  [/twitter|\bx\b/i, "x"],
  [/linkedin|\bli\b/i, "li"],
  [/bluesky|\bbs\b/i, "bs"],
  [/social/i, "social"],
  [/p2p/i, "p2p"],
  [/\bqr\b|qrcode/i, "qr"],
];

/**
 * Returns the best-guess medium for an EoA based on its utm_id.
 * Falls back to "qr" so behavior never regresses for unclassifiable rows.
 */
export function deriveUtmMedium(eoa: EoaLike): DerivedUtmMedium {
  const raw = (eoa?.utm_id ?? "").trim().toLowerCase();
  if (!raw) return "qr";

  if (EXACT_MAP[raw]) return EXACT_MAP[raw];

  for (const [pattern, medium] of SUBSTRING_RULES) {
    if (pattern.test(raw)) return medium;
  }

  return "qr";
}
