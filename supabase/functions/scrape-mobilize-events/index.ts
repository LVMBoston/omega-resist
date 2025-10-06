import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tagId, page = 1, perPage = 20, state, pullAll = false, fetchDetails = false } = await req.json();

    if (!tagId) {
      return new Response(
        JSON.stringify({ error: 'tagId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping Mobilize events with tag: ${tagId}, page: ${page}`);

    let url = `https://www.mobilize.us/mobilize/events/?tag_id=${tagId}&page=${page}`;
    if (state) {
      url += `&state=${state}`;
    }

    const response = await fetch(url);
    const html = await response.text();
    const eventIds = extractEventIds(html);

    console.log(`Found ${eventIds.length} event IDs`);

    let events = [];
    if (fetchDetails) {
      console.log('Fetching details for events...');
      for (const eventId of eventIds) {
        try {
          const detailResponse = await fetch(`https://api.mobilize.us/v1/events/${eventId}`);
          if (detailResponse.ok) {
            const data = await detailResponse.json();
            events.push(parseApiEvent(data.data));
          }
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to fetch details for event ${eventId}:`, error);
        }
      }
    }

    const result = {
      eventIds,
      events,
      totalPages: extractTotalPages(html),
      currentPage: page,
      hasMore: eventIds.length === perPage
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error scraping Mobilize events:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractEventIds(html: string): string[] {
  const eventIdRegex = /\/event\/(\d{6})\//g;
  const matches = [...html.matchAll(eventIdRegex)];
  const uniqueIds = [...new Set(matches.map(match => match[1]))];
  return uniqueIds;
}

function extractTotalPages(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc) return 1;
  
  const paginationLinks = doc.querySelectorAll('.pagination a');
  let maxPage = 1;
  
  paginationLinks.forEach(link => {
    const pageNum = parseInt(link.textContent?.trim() || '0');
    if (pageNum > maxPage) maxPage = pageNum;
  });
  
  return maxPage;
}

function parseApiEvent(event: any) {
  const location = event.location || {};
  
  return {
    eventId: event.id,
    siteName: location.venue || '',
    eventName: event.title || '',
    eventSponsor: event.sponsor?.name || '',
    address: location.address_lines?.[0] || '',
    city: location.locality || '',
    state: location.region || '',
    zipCode: location.postal_code || '',
    dateTime: event.timeslots?.[0]?.start_date ? new Date(event.timeslots[0].start_date * 1000).toISOString() : '',
    dateTimeEnd: event.timeslots?.[0]?.end_date ? new Date(event.timeslots[0].end_date * 1000).toISOString() : '',
    timezone: event.timezone || ''
  };
}
