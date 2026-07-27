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

/**
 * Parse a naive datetime string (with nominal +00/Z suffix) into a Date
 * using raw numeric components, avoiding timezone conversion.
 */
export const parseNaiveDate = (dateString: string): Date => {
  const m = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) return new Date(0);
  return new Date(
    parseInt(m[1]),
    parseInt(m[2]) - 1,
    parseInt(m[3]),
    parseInt(m[4] || "0"),
    parseInt(m[5] || "0"),
    parseInt(m[6] || "0")
  );
};

/**
 * Format elapsed milliseconds as compact label.
 * Examples: "0m", "45m", "2h 15m", "1d 3h", "7d"
 */
export const formatElapsedTime = (ms: number): string => {
  if (ms < 0) return "0m";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const remMinutes = minutes % 60;

  if (days > 0 && remHours > 0) return `${days}d ${remHours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0 && remMinutes > 0) return `${hours}h ${remMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

/**
 * Human-readable duration for an arbitrary minute count.
 * Shared by the Server-Side Rendering settings panel and the campaign
 * config page so both spell intervals identically.
 * Examples: 1 -> "1 minute", 60 -> "1 hour", 1440 -> "1 day", 10080 -> "1 week"
 */
export const formatMinutes = (mins: number): string => {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (mins % 10080 === 0) return plural(mins / 10080, "week");
  if (mins % 1440 === 0) return plural(mins / 1440, "day");
  if (mins % 60 === 0) return plural(mins / 60, "hour");
  return plural(mins, "minute");
};
