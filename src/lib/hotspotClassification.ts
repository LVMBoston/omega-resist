/**
 * Shared hotspot classification utility.
 * Auto-classifies a set of hotspots into slide type and template type
 * based on the mix of action vs data hotspot types present.
 */

export const ACTION_HOTSPOT_TYPES = new Set([
  'sms', 'email', 'social', 'external_link', 'app_download', 'email_links', 'video', 'vimeo', 'youtube'
]);

export const DATA_HOTSPOT_TYPES = new Set([
  'live_number', 'chart', 'map'
]);

export interface ClassificationResult {
  slideType: string;
  templateType: string;
}

/**
 * Classify hotspots to determine slide type and template type.
 * - No hotspots → image / display_only
 * - Only action hotspots → spread-word / interactive_share
 * - Only data hotspots → spread-word / stats_page
 * - Both action + data → spread-word / hybrid
 */
export function classifyHotspots(hotspots: any[]): ClassificationResult {
  if (!hotspots || hotspots.length === 0) {
    return { slideType: 'image', templateType: 'display_only' };
  }

  const hasAction = hotspots.some((h: any) => ACTION_HOTSPOT_TYPES.has(h.type));
  const hasData = hotspots.some((h: any) => DATA_HOTSPOT_TYPES.has(h.type));

  if (hasAction && hasData) return { slideType: 'spread-word', templateType: 'hybrid' };
  if (hasData) return { slideType: 'spread-word', templateType: 'stats_page' };
  return { slideType: 'spread-word', templateType: 'interactive_share' };
}
