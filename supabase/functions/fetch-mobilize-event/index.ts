import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mobilizeCode } = await req.json();

    if (!mobilizeCode) {
      return new Response(
        JSON.stringify({ error: 'Mobilize code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch event from Mobilize.us API
    // The Mobilize API uses event IDs in their URLs
    const mobilizeUrl = `https://api.mobilize.us/v1/events/${mobilizeCode}`;
    
    console.log('Fetching from Mobilize.us:', mobilizeUrl);
    
    const response = await fetch(mobilizeUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mobilize API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Mobilize API error: ${response.status}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Mobilize API response:', data);

    // Extract and format the event data
    const event = data.data;
    const location = event.location || {};
    
    const formattedData = {
      title: event.title || '',
      site_name: event.sponsor?.name || '',
      city: location.locality || '',
      state: location.region || '',
      zip_code: location.postal_code || '',
      type: event.event_type || 'UNKNOWN',
      start_date: event.timeslots?.[0]?.start_date 
        ? new Date(event.timeslots[0].start_date * 1000).toISOString().split('T')[0]
        : '',
      end_date: event.timeslots?.[0]?.end_date
        ? new Date(event.timeslots[0].end_date * 1000).toISOString().split('T')[0]
        : '',
      timezone: event.timezone || 'America/New_York',
      description: event.description || '',
    };

    return new Response(
      JSON.stringify(formattedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Mobilize event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
