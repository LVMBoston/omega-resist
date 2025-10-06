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
    const { eventId } = await req.json();

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'eventId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching Mobilize event: ${eventId}`);

    // Try API first
    let eventData;
    try {
      const apiResponse = await fetch(`https://api.mobilize.us/v1/events/${eventId}`);
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        eventData = parseApiResponse(apiData);
        console.log('Successfully parsed from API');
      }
    } catch (apiError) {
      console.log('API call failed, falling back to HTML scraping:', apiError);
    }

    // Fall back to HTML scraping if API failed
    if (!eventData) {
      const htmlResponse = await fetch(`https://www.mobilize.us/mobilize/event/${eventId}/`);
      const html = await htmlResponse.text();
      eventData = parseHtmlResponse(html);
      console.log('Successfully parsed from HTML');
    }

    return new Response(
      JSON.stringify(eventData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing Mobilize event:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseApiResponse(data: any) {
  const event = data.data;
  const location = event.location || {};
  
  return {
    siteName: location.venue || '',
    eventName: event.title || '',
    eventSponsor: event.sponsor?.name || '',
    address: location.address_lines?.[0] || '',
    city: location.locality || '',
    state: location.region || '',
    zipCode: location.postal_code || '',
    cityStateZip: `${location.locality || ''}, ${location.region || ''} ${location.postal_code || ''}`.trim(),
    dateTime: event.timeslots?.[0]?.start_date ? new Date(event.timeslots[0].start_date * 1000).toISOString() : '',
    dateTimeEnd: event.timeslots?.[0]?.end_date ? new Date(event.timeslots[0].end_date * 1000).toISOString() : '',
    timezone: event.timezone || '',
    fullAddress: `${location.address_lines?.[0] || ''}, ${location.locality || ''}, ${location.region || ''} ${location.postal_code || ''}`.trim(),
    source: 'api' as const
  };
}

function parseHtmlResponse(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc) throw new Error('Failed to parse HTML');

  const getTextContent = (selector: string): string => {
    return doc.querySelector(selector)?.textContent?.trim() || '';
  };

  const siteName = getTextContent('h2.event-card__location-name') || getTextContent('[itemprop="location"]');
  const eventName = getTextContent('h1.event-card__title') || getTextContent('[itemprop="name"]');
  const eventSponsor = getTextContent('.event-card__sponsor-name');
  const address = getTextContent('[itemprop="streetAddress"]');
  const city = getTextContent('[itemprop="addressLocality"]');
  const state = getTextContent('[itemprop="addressRegion"]');
  const zipCode = getTextContent('[itemprop="postalCode"]');
  const dateTime = doc.querySelector('[itemprop="startDate"]')?.getAttribute('content') || '';
  const dateTimeEnd = doc.querySelector('[itemprop="endDate"]')?.getAttribute('content') || '';

  return {
    siteName,
    eventName,
    eventSponsor,
    address,
    city,
    state,
    zipCode,
    cityStateZip: `${city}, ${state} ${zipCode}`.trim(),
    dateTime,
    dateTimeEnd,
    timezone: 'TBD',
    fullAddress: `${address}, ${city}, ${state} ${zipCode}`.trim(),
    source: 'html' as const
  };
}
