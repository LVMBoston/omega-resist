import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Slide {
  index: number;
  imageData: string; // base64
  fileName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting PowerPoint import...");
    
    // Dynamically import JSZip to catch import errors
    let JSZip;
    try {
      const jsZipModule = await import("https://esm.sh/jszip@3.10.1?target=deno");
      JSZip = jsZipModule.default;
      console.log("JSZip loaded successfully");
    } catch (importError: unknown) {
      console.error("Failed to load JSZip:", importError);
      const errorMessage = importError instanceof Error ? importError.message : String(importError);
      throw new Error(`Failed to load JSZip library: ${errorMessage}`);
    }
    
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Processing PowerPoint file: ${file.name}, size: ${file.size} bytes`);

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse the .pptx file (which is a zip archive)
    const slides: Slide[] = [];
    const zip = await JSZip.loadAsync(arrayBuffer);

    console.log(`Found ${Object.keys(zip.files).length} entries in the zip file`);

    // PowerPoint slides are stored in ppt/slides/ and ppt/media/
    // We need to match slide images
    const slideImagePattern = /^ppt\/media\//;
    const slideXmlPattern = /^ppt\/slides\/slide(\d+)\.xml$/;

    // First, get all slide XML files to determine slide count and order
    const slideNumbers: number[] = [];
    for (const filename in zip.files) {
      const match = filename.match(slideXmlPattern);
      if (match) {
        slideNumbers.push(parseInt(match[1], 10));
      }
    }
    slideNumbers.sort((a, b) => a - b);
    console.log(`Found ${slideNumbers.length} slides`);

    // Extract images from media folder
    const imageFiles: Array<{name: string, file: any}> = [];
    for (const filename in zip.files) {
      if (slideImagePattern.test(filename) && 
          (filename.endsWith('.png') || 
           filename.endsWith('.jpg') || 
           filename.endsWith('.jpeg'))) {
        imageFiles.push({ name: filename, file: zip.files[filename] });
      }
    }

    console.log(`Found ${imageFiles.length} images in media folder`);

    // For each image, extract and convert to base64
    let imageIndex = 0;
    for (const { name, file: zipFile } of imageFiles) {
      try {
        const arrayBuffer = await zipFile.async('arraybuffer');
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64 using Deno's built-in encoder
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        
        const ext = name.split('.').pop()?.toLowerCase() || 'png';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        
        slides.push({
          index: imageIndex++,
          imageData: `data:${mimeType};base64,${base64}`,
          fileName: name.split('/').pop() || `slide-${imageIndex}.${ext}`,
        });
      } catch (err) {
        console.error(`Error extracting image ${name}:`, err);
      }
    }

    console.log(`Successfully extracted ${slides.length} images`);

    if (slides.length === 0) {
      throw new Error('No images found in PowerPoint file. Make sure your slides contain images.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        slides,
        message: `Found ${slides.length} image${slides.length > 1 ? 's' : ''} in presentation`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('PowerPoint import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Failed to process PowerPoint file'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
