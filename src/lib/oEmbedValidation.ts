export interface OEmbedResult {
  title: string;
  thumbnailUrl: string;
  provider: string;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/i.test(url);
}

export function detectVideoProvider(url: string): "youtube" | "vimeo" | null {
  if (isYouTubeUrl(url)) return "youtube";
  if (isVimeoUrl(url)) return "vimeo";
  return null;
}

export async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  const provider = detectVideoProvider(url);
  if (!provider) return null;

  const endpoint =
    provider === "youtube"
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title ?? "Untitled",
      thumbnailUrl: data.thumbnail_url ?? "",
      provider: provider === "youtube" ? "YouTube" : "Vimeo",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
