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

  // Hide elements marked with capture-hide class
  const hideElements = containerElement.querySelectorAll('.capture-hide');
  hideElements.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // Hide index badges (the numbered circles on hotspots)
  const indexBadges = containerElement.querySelectorAll('[data-hotspot-overlay] > div.-top-3, [data-hotspot-overlay] > div.-bottom-3');
  indexBadges.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // Hide edit/drag toggle buttons and resize handles
  const editButtons = containerElement.querySelectorAll('[data-hotspot-overlay] button, [data-hotspot-overlay] > div.absolute.bottom-0.right-0');
  editButtons.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  // Remove vertical offset - the badges were likely causing the misalignment
  // If still needed, adjust value here
  const hotspotElements = containerElement.querySelectorAll('[data-hotspot-overlay]');
  // No transform needed now that badges are hidden

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

  // Restore index badges
  indexBadges.forEach((el) => {
    (el as HTMLElement).style.display = '';
  });

  // Restore edit buttons
  editButtons.forEach((el) => {
    (el as HTMLElement).style.display = '';
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
