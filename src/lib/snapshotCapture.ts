import html2canvas from "html2canvas";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

export interface CaptureResult {
  snapshotPath: string;
  timestamp: string;
}

/**
 * Captures a template's visual content as a compressed PNG image and uploads to storage.
 * Uses browser-image-compression for optimal file size while maintaining quality.
 * 
 * @param templateId - The ID of the template being captured
 * @param containerElement - The DOM element to capture (should contain the rendered template)
 * @param campaignCode - Optional campaign code for file naming
 * @param backgroundColor - Optional explicit background color (e.g., "#1a1a2e" for solid color templates)
 * @returns The storage path and timestamp of the captured snapshot
 */
export async function captureTemplateSnapshot(
  templateId: string,
  containerElement: HTMLElement,
  campaignCode?: string,
  backgroundColor?: string
): Promise<CaptureResult> {
  // Wait for any pending renders (maps, charts) to stabilize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Hide elements marked with capture-hide class (Replace button, etc.)
  const hideElements = containerElement.querySelectorAll('.capture-hide');
  console.log("[snapshotCapture] Hiding capture-hide elements:", hideElements.length);
  hideElements.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // Hide index badges and UI controls inside hotspots using data attribute
  const badgeElements = containerElement.querySelectorAll('[data-capture-hide]');
  console.log("[snapshotCapture] Hiding data-capture-hide elements:", badgeElements.length);
  badgeElements.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // Force synchronous reflow to ensure browser layout is stable
  void containerElement.offsetHeight;
  console.log("[snapshotCapture] Forced reflow complete");

  // Wait for browser paint cycle to complete
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 50));
  console.log("[snapshotCapture] Paint cycle delay complete, starting capture");

  // Determine the background color to use
  // Priority: explicit parameter > computed style > transparent (null)
  let captureBackground: string | null = null;
  if (backgroundColor) {
    captureBackground = backgroundColor;
    console.log("[snapshotCapture] Using explicit background color:", captureBackground);
  } else {
    const computedStyle = window.getComputedStyle(containerElement);
    const bgColor = computedStyle.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      captureBackground = bgColor;
      console.log("[snapshotCapture] Using computed background color:", captureBackground);
    } else {
      console.log("[snapshotCapture] No background color detected, using transparent");
    }
  }

  // Capture at 2x scale for retina quality
  const canvas = await html2canvas(containerElement, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    logging: false,
    backgroundColor: captureBackground,
  });

  // Restore hidden elements
  hideElements.forEach((el) => {
    (el as HTMLElement).style.display = '';
  });

  // Restore badge elements
  badgeElements.forEach((el) => {
    (el as HTMLElement).style.display = '';
  });


  // Convert canvas to PNG blob first
  const rawBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to create blob from canvas"));
      },
      "image/png"
    );
  });

  // Compress the PNG using browser-image-compression (same approach as zip imports)
  const compressedBlob = await imageCompression(
    new File([rawBlob], "snapshot.png", { type: "image/png" }),
    {
      maxSizeMB: 0.5, // Target ~500KB
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/png",
    }
  );

  console.log(`[snapshotCapture] Compressed from ${(rawBlob.size / 1024).toFixed(0)}KB to ${(compressedBlob.size / 1024).toFixed(0)}KB`);

  // Generate storage path - use slide-snapshots bucket directly
  const timestamp = new Date().toISOString();
  const fileName = campaignCode 
    ? `snapshot-${campaignCode}.png`
    : "latest.png";
  const storagePath = `${templateId}/${fileName}`;

  console.log("[snapshotCapture] Uploading to slide-snapshots bucket:", storagePath);

  // Upload to storage (upsert - replace if exists)
  const { error: uploadError } = await supabase.storage
    .from("slide-snapshots")
    .upload(storagePath, compressedBlob, {
      cacheControl: "300", // 5 minute cache
      upsert: true,
      contentType: "image/png",
    });

  if (uploadError) {
    console.error("[snapshotCapture] Upload error:", uploadError);
    throw new Error(`Failed to upload snapshot: ${uploadError.message}`);
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from("slide-snapshots")
    .getPublicUrl(storagePath);
  
  console.log("[snapshotCapture] Upload successful, public URL:", publicUrl);

  // Update the template record with snapshot info
  const { error: updateError } = await supabase
    .from("viral_slide_configs")
    .update({
      cached_snapshot_path: publicUrl,
      snapshot_rendered_at: timestamp,
    })
    .eq("id", templateId);

  if (updateError) {
    console.warn("Failed to update template snapshot metadata:", updateError);
    // Don't throw - the snapshot was still captured successfully
  }

  return {
    snapshotPath: publicUrl,
    timestamp,
  };
}

/**
 * Checks if a snapshot needs refresh based on last render time.
 */
export function isSnapshotStale(
  snapshotRenderedAt: string | null,
  maxAgeMinutes: number = 5
): boolean {
  if (!snapshotRenderedAt) return true;
  
  const renderedAt = new Date(snapshotRenderedAt);
  const now = new Date();
  const ageMinutes = (now.getTime() - renderedAt.getTime()) / (1000 * 60);
  
  return ageMinutes > maxAgeMinutes;
}
