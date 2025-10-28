interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two hotspots overlap using bounding box collision detection
 */
export function checkOverlap(h1: Hotspot, h2: Hotspot): boolean {
  const h1Right = h1.x + h1.width;
  const h1Bottom = h1.y + h1.height;
  const h2Right = h2.x + h2.width;
  const h2Bottom = h2.y + h2.height;
  
  // No overlap if one is completely to the left/right/above/below the other
  if (h1Right <= h2.x || h2Right <= h1.x || 
      h1Bottom <= h2.y || h2Bottom <= h1.y) {
    return false;
  }
  return true;
}

/**
 * Detect all overlapping hotspots
 * Returns a map of hotspot IDs to arrays of IDs they overlap with
 */
export function detectOverlaps(hotspots: Hotspot[]): Map<string, string[]> {
  const overlaps = new Map<string, string[]>();
  
  for (let i = 0; i < hotspots.length; i++) {
    for (let j = i + 1; j < hotspots.length; j++) {
      if (checkOverlap(hotspots[i], hotspots[j])) {
        // Add to h1's overlap list
        if (!overlaps.has(hotspots[i].id)) {
          overlaps.set(hotspots[i].id, []);
        }
        overlaps.get(hotspots[i].id)!.push(hotspots[j].id);
        
        // Add to h2's overlap list
        if (!overlaps.has(hotspots[j].id)) {
          overlaps.set(hotspots[j].id, []);
        }
        overlaps.get(hotspots[j].id)!.push(hotspots[i].id);
      }
    }
  }
  
  return overlaps;
}

/**
 * Calculate the intersection rectangle for two overlapping hotspots
 */
export function calculateIntersectionRect(
  h1: Hotspot, 
  h2: Hotspot
): { x: number; y: number; width: number; height: number } | null {
  if (!checkOverlap(h1, h2)) return null;
  
  const x = Math.max(h1.x, h2.x);
  const y = Math.max(h1.y, h2.y);
  const right = Math.min(h1.x + h1.width, h2.x + h2.width);
  const bottom = Math.min(h1.y + h1.height, h2.y + h2.height);
  
  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

/**
 * Get all intersection areas for hotspots
 */
export function getAllIntersections(hotspots: Hotspot[]): Array<{
  x: number;
  y: number;
  width: number;
  height: number;
  hotspotIds: [string, string];
}> {
  const intersections: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    hotspotIds: [string, string];
  }> = [];
  
  for (let i = 0; i < hotspots.length; i++) {
    for (let j = i + 1; j < hotspots.length; j++) {
      const intersection = calculateIntersectionRect(hotspots[i], hotspots[j]);
      if (intersection) {
        intersections.push({
          ...intersection,
          hotspotIds: [hotspots[i].id, hotspots[j].id]
        });
      }
    }
  }
  
  return intersections;
}

/**
 * Check if a hotspot is out of bounds (extends beyond 0-100% range)
 */
export function isOutOfBounds(hotspot: Hotspot): boolean {
  return (
    hotspot.x < 0 ||
    hotspot.y < 0 ||
    hotspot.x + hotspot.width > 100 ||
    hotspot.y + hotspot.height > 100
  );
}

/**
 * Detect all out-of-bounds hotspots
 * Returns an array of hotspot IDs that are out of bounds
 */
export function detectOutOfBounds(hotspots: Hotspot[]): string[] {
  return hotspots
    .filter(hotspot => isOutOfBounds(hotspot))
    .map(hotspot => hotspot.id);
}

/**
 * Get the maximum allowed size for a hotspot at a given position
 */
export function getMaxSize(x: number, y: number, aspectRatio: number): { maxWidth: number; maxHeight: number } {
  const maxWidthFromX = 100 - x;
  const maxHeightFromY = 100 - y;
  
  // Calculate based on aspect ratio constraints
  const maxWidthFromAspect = maxHeightFromY / aspectRatio;
  const maxHeightFromAspect = maxWidthFromX * aspectRatio;
  
  return {
    maxWidth: Math.min(maxWidthFromX, maxWidthFromAspect),
    maxHeight: Math.min(maxHeightFromY, maxHeightFromAspect)
  };
}
