/**
 * Detects if a GIF file contains multiple frames (is animated)
 * Returns true if animated, false if static single-frame GIF
 */
export const isAnimatedGif = async (file: File | Blob): Promise<boolean> => {
  if (file.type !== 'image/gif') return false;

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // GIF signature check
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) {
    return false; // Not a valid GIF
  }

  // Look for multiple Image Descriptor blocks (0x2C)
  // An animated GIF will have multiple 0x2C bytes
  let imageDescriptorCount = 0;
  
  for (let i = 0; i < bytes.length - 1; i++) {
    // Image Descriptor starts with 0x2C
    if (bytes[i] === 0x2C) {
      imageDescriptorCount++;
      if (imageDescriptorCount > 1) {
        return true; // Found multiple frames, it's animated
      }
    }
  }

  return false; // Only one frame, static GIF
};
