import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignRecapData {
  campaign: {
    title: string;
    code: string;
    description: string | null;
    created_at: string;
  };
  events: Array<{
    title: string;
    type: string;
    city: string | null;
    state: string | null;
    start_date: string | null;
    zip_code: string | null;
  }>;
  tokensByLevel: Record<number, { count: number; uniqueParents: number }>;
  totalTokens: number;
  engagement: {
    views: number;
    scans: number;
    shares: number;
  };
  maxLevel: number;
  eventCoordinates: Array<{ lat: number; lng: number; title: string }>;
}

interface Campaign {
  id: string;
  title: string;
  code: string;
  description: string | null;
  created_at: string;
}

interface EventAction {
  id: string;
  title: string;
  type: string;
  city: string | null;
  state: string | null;
  start_date: string | null;
  zip_code: string | null;
}

interface Token {
  token: string;
  level: number;
  parent_token: string | null;
}

interface UrlEvent {
  event_type: string;
}

interface ZipCode {
  zip_code: string;
  latitude: number;
  longitude: number;
}

// deno-lint-ignore no-explicit-any
async function fetchCampaignRecapData(supabase: any, campaignCode: string): Promise<CampaignRecapData> {
  console.log(`Fetching campaign data for: ${campaignCode}`);
  
  // Fetch campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('code', campaignCode)
    .single();

  if (campaignError || !campaign) {
    console.error('Campaign not found:', campaignError);
    throw new Error(`Campaign not found: ${campaignCode}`);
  }

  const typedCampaign = campaign as Campaign;
  console.log(`Found campaign: ${typedCampaign.title}`);

  // Fetch events
  const { data: eventsData } = await supabase
    .from('events_actions')
    .select('id, title, type, city, state, start_date, zip_code')
    .eq('campaign_id', typedCampaign.id);

  const events = (eventsData || []) as EventAction[];
  console.log(`Found ${events.length} events`);

  // Get event IDs for token lookup
  const eventIds = events.map(e => e.id);

  // Fetch tokens with level distribution
  const { data: tokensData } = await supabase
    .from('tokens')
    .select('token, level, parent_token')
    .eq('is_simulated', false)
    .in('eoa_id', eventIds);

  const tokens = (tokensData || []) as Token[];
  console.log(`Found ${tokens.length} tokens`);

  // Calculate token distribution by level
  const tokensByLevel: Record<number, { count: number; uniqueParents: Set<string> }> = {};
  let maxLevel = 0;

  tokens.forEach(t => {
    if (!tokensByLevel[t.level]) {
      tokensByLevel[t.level] = { count: 0, uniqueParents: new Set() };
    }
    tokensByLevel[t.level].count++;
    if (t.parent_token) {
      tokensByLevel[t.level].uniqueParents.add(t.parent_token);
    }
    maxLevel = Math.max(maxLevel, t.level);
  });

  // Convert Sets to counts
  const tokensByLevelFinal: Record<number, { count: number; uniqueParents: number }> = {};
  Object.entries(tokensByLevel).forEach(([level, data]) => {
    tokensByLevelFinal[Number(level)] = {
      count: data.count,
      uniqueParents: data.uniqueParents.size || (Number(level) === 0 ? 1 : 0)
    };
  });

  // Fetch engagement data
  const tokenIds = tokens.map(t => t.token);
  const { data: urlEventsData } = await supabase
    .from('url_events')
    .select('event_type')
    .in('token', tokenIds)
    .eq('is_simulated', false);

  const urlEvents = (urlEventsData || []) as UrlEvent[];
  const engagement = {
    views: urlEvents.filter(e => e.event_type === 'view').length,
    scans: urlEvents.filter(e => e.event_type === 'scan').length,
    shares: urlEvents.filter(e => e.event_type === 'share').length,
  };

  // Get coordinates from zip codes for map
  const zipCodes = [...new Set(events.map(e => e.zip_code).filter(Boolean))] as string[];
  const eventCoordinates: Array<{ lat: number; lng: number; title: string }> = [];

  if (zipCodes.length > 0) {
    const { data: zipData } = await supabase
      .from('zip_codes')
      .select('zip_code, latitude, longitude')
      .in('zip_code', zipCodes);

    const typedZipData = (zipData || []) as ZipCode[];
    const zipMap = new Map(typedZipData.map(z => [z.zip_code, { lat: z.latitude, lng: z.longitude }]));
    
    events.forEach(event => {
      if (event.zip_code && zipMap.has(event.zip_code)) {
        const coords = zipMap.get(event.zip_code)!;
        eventCoordinates.push({ lat: coords.lat, lng: coords.lng, title: event.title });
      }
    });
  }

  console.log(`Found ${eventCoordinates.length} event coordinates for map`);

  return {
    campaign: {
      title: typedCampaign.title,
      code: typedCampaign.code,
      description: typedCampaign.description,
      created_at: typedCampaign.created_at,
    },
    events,
    tokensByLevel: tokensByLevelFinal,
    totalTokens: tokens.length,
    engagement,
    maxLevel,
    eventCoordinates,
  };
}

// Simple report generation as text
function generateReportContent(data: CampaignRecapData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`Campaign Recap: ${data.campaign.code}`);
  lines.push(`Title: ${data.campaign.title}`);
  if (data.campaign.description) {
    lines.push(`Description: ${data.campaign.description}`);
  }
  lines.push(`Created: ${new Date(data.campaign.created_at).toLocaleDateString()}`);
  lines.push('');
  
  // Events
  lines.push('=== Events/Actions ===');
  if (data.events.length === 0) {
    lines.push('No events found');
  } else {
    data.events.forEach(event => {
      const location = [event.city, event.state].filter(Boolean).join(', ');
      const date = event.start_date ? new Date(event.start_date).toLocaleDateString() : 'No date';
      lines.push(`- ${event.title} (${event.type})`);
      lines.push(`  ${location || 'No location'} | ${date}`);
    });
  }
  lines.push('');
  
  // Token Distribution
  lines.push('=== Token Distribution ===');
  lines.push('Level | Token Count | Unique Parents');
  const levels = Object.keys(data.tokensByLevel).map(Number).sort((a, b) => a - b);
  levels.forEach(level => {
    const levelData = data.tokensByLevel[level];
    lines.push(`L${level}    | ${levelData.count}           | ${levelData.uniqueParents}`);
  });
  const totalParents = levels.reduce((sum, level) => sum + (data.tokensByLevel[level]?.uniqueParents || 0), 0);
  lines.push(`Total | ${data.totalTokens}           | ${totalParents}`);
  lines.push('');
  
  // Key Metrics
  lines.push('=== Key Metrics ===');
  lines.push(`Tokens Minted: ${data.totalTokens}`);
  const totalEvents = data.engagement.views + data.engagement.scans + data.engagement.shares;
  lines.push(`Events Recorded: ${totalEvents}`);
  lines.push(`  - Views: ${data.engagement.views}`);
  lines.push(`  - Scans: ${data.engagement.scans}`);
  lines.push(`  - Shares: ${data.engagement.shares}`);
  lines.push('');
  
  // Viral Spread
  lines.push('=== Viral Spread Summary ===');
  lines.push(`Maximum propagation depth: ${data.maxLevel} levels`);
  const mostActiveLevel = levels.reduce((max, level) => 
    (data.tokensByLevel[level]?.count || 0) > (data.tokensByLevel[max]?.count || 0) ? level : max
  , levels[0] || 0);
  lines.push(`Most active level: L${mostActiveLevel} with ${data.tokensByLevel[mostActiveLevel]?.count || 0} tokens`);
  lines.push('');
  
  // Map coordinates for reference
  if (data.eventCoordinates.length > 0) {
    lines.push('=== Event Locations ===');
    data.eventCoordinates.forEach(coord => {
      lines.push(`- ${coord.title}: (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})`);
    });
  }
  
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  
  return lines.join('\n');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let campaignCode: string | null = null;

    // Support both GET with query param and POST with body
    if (req.method === 'GET') {
      campaignCode = url.searchParams.get('campaign');
    } else if (req.method === 'POST') {
      const body = await req.json();
      campaignCode = body.campaign || body.campaignCode;
    }

    if (!campaignCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: campaign' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Generating report for campaign: ${campaignCode}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch campaign data
    const data = await fetchCampaignRecapData(supabase, campaignCode);

    // Generate text-based report
    const reportContent = generateReportContent(data);

    // Return as downloadable text file
    return new Response(reportContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${campaignCode}-recap.txt"`,
      },
    });

  } catch (error) {
    console.error('Error generating report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});