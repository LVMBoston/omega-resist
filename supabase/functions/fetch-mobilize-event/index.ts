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
    
    // Helper function to convert Unix timestamp to local datetime string for the event's timezone
    const formatDatetimeInTimezone = (unixTimestamp: number, timezone: string): string => {
      const date = new Date(unixTimestamp * 1000);
      
      // Use Intl.DateTimeFormat to get the date/time in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const hour = parts.find(p => p.type === 'hour')?.value;
      const minute = parts.find(p => p.type === 'minute')?.value;
      
      return `${year}-${month}-${day}T${hour}:${minute}`;
    };
    
    const eventTimezone = event.timezone || 'America/New_York';
    
    const formattedData = {
      title: event.title || '',
      site_name: event.sponsor?.name || '',
      city: location.locality || '',
      state: location.region || '',
      zip_code: location.postal_code || '',
      type: event.event_type || 'UNKNOWN',
      start_date: event.timeslots?.[0]?.start_date 
        ? formatDatetimeInTimezone(event.timeslots[0].start_date, eventTimezone)
        : '',
      end_date: event.timeslots?.[0]?.end_date
        ? formatDatetimeInTimezone(event.timeslots[0].end_date, eventTimezone)
        : '',
      timezone: eventTimezone,
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
