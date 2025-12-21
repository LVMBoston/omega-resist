/**
 * Format a floating local time date string.
 * 
 * Floating local times are stored as naive datetimes with a nominal "+00" or "Z" suffix.
 * They represent wall-clock time, NOT UTC instants.
 * 
 * Example: "2025-12-15T00:00:00.000Z" means "Dec 15, 2025 12:00 AM" as wall-clock time.
 */
export const formatFloatingLocalTime = (dateString: string, format: "short" | "full" = "full"): string => {
  if (!dateString) return "—";
  
  // Parse as naive datetime - extract components directly WITHOUT timezone conversion
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?/);
  if (!match) return dateString;
  
  const [, year, month, day, hour = "00", minute = "00"] = match;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = parseInt(hour, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  
  if (format === "short") {
    return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
  }
  
  return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year} ${h12}:${minute} ${ampm}`;
};

/**
 * Format a time delta in milliseconds to a human-readable descriptive string.
 * 
 * Examples:
 * - 45 minutes
 * - 2 hours and 15 minutes
 * - 1 day, 3 hours and 22 minutes
 * - 3 days later
 */
export const formatTimeDelta = (ms: number): string => {
  if (ms < 0) return "before";
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  
  const parts: string[] = [];
  
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }
  
  if (remainingHours > 0) {
    parts.push(`${remainingHours} ${remainingHours === 1 ? "hour" : "hours"}`);
  }
  
  if (remainingMinutes > 0 && days === 0) {
    // Only show minutes if less than a day
    parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}`);
  }
  
  if (parts.length === 0) {
    return "less than a minute";
  }
  
  if (parts.length === 1) {
    return parts[0];
  }
  
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  
  // 3 parts: "X days, Y hours and Z minutes"
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`;
};
