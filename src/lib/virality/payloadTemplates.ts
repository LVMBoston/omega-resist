/**
 * Generic URL payload templates, one per lineage level.
 *
 * MUST stay in lockstep with the two DB RPCs that actually build these URLs:
 *   - public.mint_l00        (level 0, seeds — utm_content present, no p=)
 *   - public.instantiate_l00_token / maybe_reinstantiate_l00
 *                            (rewrites t= with :suffix on first open)
 *   - public.mint_share      (levels 1..3, no utm_content, p= set)
 *
 * If you edit either RPC, update this file and its snapshot test.
 */

export type ColorRole =
  | "campaign"
  | "eoa"
  | "level"
  | "medium"
  | "content"
  | "self-token"
  | "parent-token"
  | "static";

export interface Segment {
  /** Query-key including trailing `=`, or `""` for path segments. */
  key: string;
  /** Value shown after the key (may contain `{placeholder}` markers). */
  value: string;
  /** Semantic color class for the value span. */
  colorRole: ColorRole;
  /** Optional note shown on hover. */
  note?: string;
}

export interface LevelTemplate {
  id: "l00-base" | "l00-instance" | "l01" | "l02" | "l03";
  label: string;
  description: string;
  segments: Segment[];
}

const BASE = "https://omega-resist.lovable.app/deck/";

/** Shared path prefix: domain + deck slug. */
const pathSegments = (): Segment[] => [
  { key: "", value: BASE, colorRole: "static" },
  { key: "", value: "{deck_slug}", colorRole: "static" },
  { key: "", value: "?", colorRole: "static" },
];

/** Segments carried unchanged across every level. */
const commonUtm = (): Segment[] => [
  { key: "utm_campaign=", value: "{campaign_code}", colorRole: "campaign" },
  { key: "utm_id=", value: "{utm_id}", colorRole: "eoa" },
];

export const L00_BASE: LevelTemplate = {
  id: "l00-base",
  label: "L00 base (seed)",
  description:
    "Freshly minted by mint_l00. What's printed on the QR / pasted in the send. Before anyone opens it.",
  segments: [
    ...pathSegments(),
    ...commonUtm(),
    { key: "utm_source=", value: "L00", colorRole: "level" },
    {
      key: "utm_medium=",
      value: "{derived_from_utm_id}",
      colorRole: "medium",
      note: "derive_utm_medium(utm_id): em | sms | qr | fb | x | li | bs | social | p2p",
    },
    {
      key: "utm_content=",
      value: "{mobilize_code}-{utm_id}",
      colorRole: "content",
    },
    {
      key: "t=",
      value: "l00-{mobilize_code}-{utm_id_first_10}",
      colorRole: "self-token",
    },
    { key: "v_lvl=", value: "00", colorRole: "level" },
  ],
};

export const L00_INSTANCE: LevelTemplate = {
  id: "l00-instance",
  label: "L00 instance (post-first-open)",
  description:
    "First time the base URL opens, instantiate_l00_token appends a random 6-char suffix to t=. All later opens attach to this instance (or re-instantiate if ZIP changes / EoA type = Event).",
  segments: [
    ...pathSegments(),
    ...commonUtm(),
    { key: "utm_source=", value: "L00", colorRole: "level" },
    { key: "utm_medium=", value: "{derived_from_utm_id}", colorRole: "medium" },
    {
      key: "utm_content=",
      value: "{mobilize_code}-{utm_id}",
      colorRole: "content",
    },
    {
      key: "t=",
      value: "l00-{mobilize_code}-{utm_id_first_10}:{suffix}",
      colorRole: "self-token",
      note: "suffix = 6 hex chars appended on first open",
    },
    { key: "v_lvl=", value: "00", colorRole: "level" },
  ],
};

export const L01: LevelTemplate = {
  id: "l01",
  label: "L01 (first viral share)",
  description:
    "Minted by mint_share when a viewer shares. Parent is the L00 instance. utm_content is dropped from here down.",
  segments: [
    ...pathSegments(),
    ...commonUtm(),
    { key: "utm_source=", value: "L01", colorRole: "level" },
    {
      key: "utm_medium=",
      value: "{sharer_choice}",
      colorRole: "medium",
      note: "em | sms | tx | social | p2p | fb | bs | li | x (qr rejected on shares)",
    },
    { key: "t=", value: "{t_L01}", colorRole: "self-token", note: "8 hex chars" },
    {
      key: "p=",
      value: "l00-{mobilize_code}-{utm_id_first_10}:{suffix}",
      colorRole: "parent-token",
      note: "parent = the L00 instance that opened the link",
    },
    { key: "v_lvl=", value: "01", colorRole: "level" },
  ],
};

export const L02: LevelTemplate = {
  id: "l02",
  label: "L02 (share of a share)",
  description: "Minted by mint_share from an L01. Parent is the L01 token.",
  segments: [
    ...pathSegments(),
    ...commonUtm(),
    { key: "utm_source=", value: "L02", colorRole: "level" },
    { key: "utm_medium=", value: "{sharer_choice}", colorRole: "medium" },
    { key: "t=", value: "{t_L02}", colorRole: "self-token" },
    { key: "p=", value: "{t_L01}", colorRole: "parent-token" },
    { key: "v_lvl=", value: "02", colorRole: "level" },
  ],
};

export const L03: LevelTemplate = {
  id: "l03",
  label: "L03 (terminal share)",
  description:
    "Minted from an L02. Level is capped at 3 by mint_share (LEAST(parent+1, 3)) — further shares stay at L03.",
  segments: [
    ...pathSegments(),
    ...commonUtm(),
    { key: "utm_source=", value: "L03", colorRole: "level" },
    { key: "utm_medium=", value: "{sharer_choice}", colorRole: "medium" },
    { key: "t=", value: "{t_L03}", colorRole: "self-token" },
    { key: "p=", value: "{t_L02}", colorRole: "parent-token" },
    { key: "v_lvl=", value: "03", colorRole: "level" },
  ],
};

export const ALL_LEVELS: LevelTemplate[] = [
  L00_BASE,
  L00_INSTANCE,
  L01,
  L02,
  L03,
];

export const COLOR_LEGEND: Array<{ role: ColorRole; label: string }> = [
  { role: "campaign", label: "utm_campaign (same across all levels)" },
  { role: "eoa", label: "utm_id (same across all levels)" },
  { role: "level", label: "level markers (utm_source, v_lvl)" },
  { role: "medium", label: "channel (utm_medium)" },
  { role: "content", label: "utm_content (L00 only)" },
  { role: "self-token", label: "self token (t=)" },
  { role: "parent-token", label: "parent token (p=)" },
];
