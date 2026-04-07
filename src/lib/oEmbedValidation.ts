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

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const proxyUrl = `https://${projectId}.supabase.co/functions/v1/oembed-proxy?url=${encodeURIComponent(url)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        "apikey": anonKey,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title ?? "Untitled",
      thumbnailUrl: data.thumbnailUrl ?? "",
      provider: data.provider ?? (provider === "youtube" ? "YouTube" : "Vimeo"),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
