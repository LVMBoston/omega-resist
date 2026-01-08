import { supabase } from "@/integrations/supabase/client";

interface ExportEvent {
  event_id: string;
  occurred_at: string;
  event_type: string;
  token: string;
  level: number;
  parent_token: string | null;
  root_token: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_campaign: string | null;
  zip_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  minted_at: string;
  deck_slug: string;
}

export async function exportCampaignData(campaignCode: string): Promise<{ csv: string; stats: { events: number; tokens: number; rootTokens: number } }> {
  // First get all tokens for this campaign
  const { data: tokens, error: tokensError } = await supabase
    .from('tokens')
    .select('token, level, parent_token, root_token, utm_source, utm_medium, utm_content, utm_campaign, minted_at, deck_slug')
    .eq('utm_campaign', campaignCode)
    .eq('is_simulated', false)
    .is('deleted_at', null);

  if (tokensError) {
    throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
  }

  if (!tokens || tokens.length === 0) {
    throw new Error(`No tokens found for campaign: ${campaignCode}`);
  }

  // Create a map for quick token lookup
  const tokenMap = new Map(tokens.map(t => [t.token, t]));
  const tokenList = tokens.map(t => t.token);

  // Get all events for these tokens
  const { data: events, error: eventsError } = await supabase
    .from('url_events')
    .select('id, occurred_at, event_type, token, zip_code, city, region, country, latitude, longitude, location_source')
    .in('token', tokenList)
    .eq('is_simulated', false)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: true });

  if (eventsError) {
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }

  if (!events || events.length === 0) {
    throw new Error(`No events found for campaign: ${campaignCode}`);
  }

  // Calculate stats
  const uniqueTokens = new Set(events.map(e => e.token));
  const rootTokens = new Set(tokens.filter(t => t.level === 0).map(t => {
    // Get base token (without instance suffix)
    return t.token.split(':')[0];
  }));

  const stats = {
    events: events.length,
    tokens: uniqueTokens.size,
    rootTokens: rootTokens.size
  };

  // Build the export data
  const exportData: ExportEvent[] = events.map(e => {
    const tokenInfo = tokenMap.get(e.token);
    return {
      event_id: e.id,
      occurred_at: e.occurred_at,
      event_type: e.event_type,
      token: e.token,
      level: tokenInfo?.level ?? -1,
      parent_token: tokenInfo?.parent_token ?? null,
      root_token: tokenInfo?.root_token ?? null,
      utm_source: tokenInfo?.utm_source ?? null,
      utm_medium: tokenInfo?.utm_medium ?? null,
      utm_content: tokenInfo?.utm_content ?? null,
      utm_campaign: tokenInfo?.utm_campaign ?? null,
      zip_code: e.zip_code,
      city: e.city,
      region: e.region,
      country: e.country,
      latitude: e.latitude,
      longitude: e.longitude,
      location_source: e.location_source,
      minted_at: tokenInfo?.minted_at ?? '',
      deck_slug: tokenInfo?.deck_slug ?? ''
    };
  });

  // Build CSV content
  const csv = buildCsv(exportData, campaignCode, stats);

  return { csv, stats };
}

function buildCsv(
  data: ExportEvent[], 
  campaignCode: string, 
  stats: { events: number; tokens: number; rootTokens: number }
): string {
  const timestamp = new Date().toISOString();
  
  // Instructions header
  const instructions = [
    `# SAMIZDAT CAMPAIGN DATA EXPORT - ${campaignCode}`,
    `# Generated: ${timestamp}`,
    `# Total Events: ${stats.events} | Unique Tokens: ${stats.tokens} | Root Tokens: ${stats.rootTokens}`,
    `#`,
    `# HOW TO IDENTIFY A CHAIN:`,
    `# 1. Select any event row`,
    `# 2. Look at the "root_token" column - this identifies the chain family`,
    `# 3. Look at the "token" column - this is the specific token for this event`,
    `# 4. To find the parent: look for events where "token" = this row's "parent_token"`,
    `# 5. To find children: filter where "parent_token" = this row's "token"`,
    `#`,
    `# LEVEL KEY:`,
    `# L00 (level=0) = Original scan (from QR/mail/text)`,
    `# L01 (level=1) = First share (child of L00)`,
    `# L02 (level=2) = Second generation share`,
    `# L03 (level=3) = Third generation share (capped)`,
    `#`,
    `# INSTANCE SUFFIX: Tokens like "l00-837854-rs1-qr:236f5b" have a ":hexcode" suffix`,
    `# This suffix indicates a unique L00 scan instance. The bug caused multiple people`,
    `# to share the same instance token via URL copy instead of minting child tokens.`,
    `#`,
    `# IDENTIFYING THE BUG: Look for L00 tokens with multiple events from DIFFERENT zip codes.`,
    `# These should have been separate child tokens (L01) but weren't due to the bug.`,
    `#`
  ];

  // Column headers
  const headers = [
    'row_num',
    'event_id',
    'occurred_at',
    'event_type',
    'token',
    'level',
    'parent_token',
    'root_token',
    'utm_source',
    'utm_medium',
    'utm_content',
    'utm_campaign',
    'zip_code',
    'city',
    'region',
    'country',
    'latitude',
    'longitude',
    'location_source',
    'minted_at',
    'deck_slug'
  ];

  // Build CSV rows
  const rows: string[] = [];
  
  // Add instructions as comment rows
  instructions.forEach(line => rows.push(line));
  
  // Add header row
  rows.push(headers.join(','));
  
  // Add data rows
  data.forEach((row, index) => {
    const values = [
      index + 1,
      escapeCsvValue(row.event_id),
      escapeCsvValue(row.occurred_at),
      escapeCsvValue(row.event_type),
      escapeCsvValue(row.token),
      row.level,
      escapeCsvValue(row.parent_token ?? ''),
      escapeCsvValue(row.root_token ?? ''),
      escapeCsvValue(row.utm_source ?? ''),
      escapeCsvValue(row.utm_medium ?? ''),
      escapeCsvValue(row.utm_content ?? ''),
      escapeCsvValue(row.utm_campaign ?? ''),
      escapeCsvValue(row.zip_code ?? ''),
      escapeCsvValue(row.city ?? ''),
      escapeCsvValue(row.region ?? ''),
      escapeCsvValue(row.country ?? ''),
      row.latitude ?? '',
      row.longitude ?? '',
      escapeCsvValue(row.location_source ?? ''),
      escapeCsvValue(row.minted_at),
      escapeCsvValue(row.deck_slug)
    ];
    rows.push(values.join(','));
  });

  return rows.join('\n');
}

function escapeCsvValue(value: string): string {
  if (!value) return '';
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(csv: string, campaignCode: string): void {
  const date = new Date().toISOString().split('T')[0];
  const filename = `${campaignCode}-chain-data-${date}.csv`;
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
