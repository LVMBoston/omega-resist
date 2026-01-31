import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";

export interface CaptureResult {
  snapshotPath: string;
  timestamp: string;
}

/**
 * Captures a template's visual content as a WebP image and uploads to storage.
 * 
 * @param templateId - The ID of the template being captured
 * @param containerElement - The DOM element to capture (should contain the rendered template)
 * @param campaignCode - Optional campaign code for file naming
 * @returns The storage path and timestamp of the captured snapshot
 */
export async function captureTemplateSnapshot(
  templateId: string,
  containerElement: HTMLElement,
  campaignCode?: string
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

  // Apply vertical offset to hotspot overlays to correct html2canvas alignment
  // Directly modify the 'top' style since these are percentage-positioned absolute elements
  const hotspotElements = containerElement.querySelectorAll('[data-hotspot-overlay]');
  console.log("[snapshotCapture] Applying vertical offset to hotspots:", hotspotElements.length);
  const originalTops: string[] = [];
  hotspotElements.forEach((el, i) => {
    const htmlEl = el as HTMLElement;
    originalTops[i] = htmlEl.style.top;
    const currentTop = parseFloat(htmlEl.style.top) || 0;
    // Log before modification
    console.log(`[snapshotCapture] Hotspot ${i}: original top = ${currentTop}%`);
    // Subtract ~1% which is roughly 7-8px on a 700px tall container
    const newTop = currentTop - 1;
    htmlEl.style.top = `${newTop}%`;
    console.log(`[snapshotCapture] Hotspot ${i}: new top = ${newTop}%`);
  });

  // CRITICAL: Force synchronous reflow to ensure browser updates layout
  void containerElement.offsetHeight;
  console.log("[snapshotCapture] Forced reflow complete");

  // Wait for browser paint cycle to complete
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 50));
  console.log("[snapshotCapture] Paint cycle delay complete, starting capture");

  // Capture at 2x scale for retina quality
  const canvas = await html2canvas(containerElement, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    logging: false,
    backgroundColor: null,
  });

  // Restore hidden elements
  hideElements.forEach((el) => {
    (el as HTMLElement).style.display = '';
  });

  // Restore badge elements
  badgeElements.forEach((el) => {
    (el as HTMLElement).style.display = '';
  });

  // Restore hotspot top positions
  hotspotElements.forEach((el, i) => {
    (el as HTMLElement).style.top = originalTops[i] || '';
  });

  // Convert to WebP with quality targeting ~500KB
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to create blob from canvas"));
      },
      "image/webp",
      0.85 // Quality setting
    );
  });

  // Generate storage path - use slide-snapshots bucket directly
  const timestamp = new Date().toISOString();
  const fileName = campaignCode 
    ? `snapshot-${campaignCode}.webp`
    : "latest.webp";
  const storagePath = `${templateId}/${fileName}`;

  console.log("[snapshotCapture] Uploading to slide-snapshots bucket:", storagePath);

  // Upload to storage (upsert - replace if exists)
  const { error: uploadError } = await supabase.storage
    .from("slide-snapshots")
    .upload(storagePath, blob, {
      cacheControl: "300", // 5 minute cache
      upsert: true,
      contentType: "image/webp",
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
