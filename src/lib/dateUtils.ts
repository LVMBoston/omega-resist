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
