import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

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
    const slideImagePattern = /^ppt\/slides\/media\//;
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
    for (const { name, file } of imageFiles) {
      try {
        const arrayBuffer = await file.async('arraybuffer');
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data: string, byte: number) => data + String.fromCharCode(byte),
            ''
          )
        );
        
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
