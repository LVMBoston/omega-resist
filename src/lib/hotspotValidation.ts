import { DATA_HOTSPOT_TYPES } from './hotspotClassification';

interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  labelPosition?: 'top' | 'bottom';
  type?: string;
}

/**
 * Get expanded bounds for a hotspot including its label area.
 * Only expands if the hotspot has a non-empty label.
 */
function getExpandedBounds(h: Hotspot): { x: number; y: number; right: number; bottom: number } {
  const hasLabel = h.label && h.label.trim().length > 0;
  // external_link labels are email metadata only — don't expand bounding box
  const labelArea = (hasLabel && h.type !== 'external_link') ? 4 : 0;
  
  let expandedY = h.y;
  let expandedBottom = h.y + h.height;
  
  if (labelArea > 0) {
    if (h.labelPosition === 'top') {
      expandedY = Math.max(0, h.y - labelArea);
    } else {
      expandedBottom = Math.min(100, h.y + h.height + labelArea);
    }
  }
  
  return {
    x: h.x,
    y: expandedY,
    right: h.x + h.width,
    bottom: expandedBottom
  };
}

/**
 * Check if two hotspots overlap using bounding box collision detection
 * Includes label areas in the overlap calculation
 */
export function checkOverlap(h1: Hotspot, h2: Hotspot): boolean {
  const bounds1 = getExpandedBounds(h1);
  const bounds2 = getExpandedBounds(h2);
  
  // No overlap if one is completely to the left/right/above/below the other
  if (bounds1.right <= bounds2.x || bounds2.right <= bounds1.x || 
      bounds1.bottom <= bounds2.y || bounds2.bottom <= bounds1.y) {
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
 * Includes label areas in the intersection calculation
 */
export function calculateIntersectionRect(
  h1: Hotspot, 
  h2: Hotspot
): { x: number; y: number; width: number; height: number } | null {
  if (!checkOverlap(h1, h2)) return null;
  
  const bounds1 = getExpandedBounds(h1);
  const bounds2 = getExpandedBounds(h2);
  
  const x = Math.max(bounds1.x, bounds2.x);
  const y = Math.max(bounds1.y, bounds2.y);
  const right = Math.min(bounds1.right, bounds2.right);
  const bottom = Math.min(bounds1.bottom, bounds2.bottom);
  
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
 * Check if a hotspot is out of bounds (extends beyond valid placement area)
 * Allows 2% padding at top/bottom for labels (reduced from 4%)
 */
export function isOutOfBounds(hotspot: Hotspot): boolean {
  const hasLabel = hotspot.label && hotspot.label.trim().length > 0;
  const labelPadding = hasLabel ? 2 : 0;
  
  return (
    hotspot.x < 0 ||
    hotspot.y < labelPadding ||
    hotspot.x + hotspot.width > 100 ||
    hotspot.y + hotspot.height > 100 - labelPadding
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
 * Accounts for 2% label padding at top/bottom
 */
export function getMaxSize(x: number, y: number, aspectRatio: number): { maxWidth: number; maxHeight: number } {
  const labelPadding = 2; // 2% padding for labels (reduced from 4%)
  
  const maxWidthFromX = 100 - x;
  const maxHeightFromY = (100 - labelPadding) - y;
  
  // Calculate based on aspect ratio constraints
  const maxWidthFromAspect = maxHeightFromY / aspectRatio;
  const maxHeightFromAspect = maxWidthFromX * aspectRatio;
  
  return {
    maxWidth: Math.min(maxWidthFromX, maxWidthFromAspect),
    maxHeight: Math.min(maxHeightFromY, maxHeightFromAspect)
  };
}
