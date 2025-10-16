import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as xlsx from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting zip code import...');

    // Get the file from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Processing file: ${file.name}`);

    // Read the Excel file
    const fileBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(new Uint8Array(fileBuffer), { type: 'array' });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = xlsx.utils.sheet_to_json(worksheet) as any[];
    
    console.log(`Found ${rawData.length} rows to import`);

    // Transform data to match our table structure
    const zipCodes = rawData.map((row: any) => ({
      zip_code: String(row.zip || '').padStart(5, '0'),
      latitude: parseFloat(row.lat),
      longitude: parseFloat(row.lng),
      city: row.city || '',
      state_id: row.state_id || '',
      state_name: row.state_name || '',
      timezone: row.timezone || '',
    })).filter(zc => zc.zip_code && !isNaN(zc.latitude) && !isNaN(zc.longitude));

    console.log(`Importing ${zipCodes.length} valid zip codes...`);

    // Delete existing data first
    console.log('Clearing existing zip codes...');
    const { error: deleteError } = await supabase
      .from('zip_codes')
      .delete()
      .neq('zip_code', '00000'); // Delete all

    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
      throw deleteError;
    }

    // Insert in batches of 500
    const batchSize = 500;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('zip_codes')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        failed += batch.length;
      } else {
        imported += batch.length;
        console.log(`Imported batch ${i / batchSize + 1}: ${imported}/${zipCodes.length}`);
      }
    }

    console.log(`Import complete: ${imported} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        failed,
        total: zipCodes.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
