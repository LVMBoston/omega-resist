const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const videoUrl = url.searchParams.get('url')

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(videoUrl)
  const isVimeo = /vimeo\.com/i.test(videoUrl)

  if (!isYouTube && !isVimeo) {
    return new Response(JSON.stringify({ error: 'Unsupported video provider', fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Build candidate URLs to try. Vimeo's oEmbed endpoint rejects share-link
  // query params (?share=copy&fl=sv&fe=ci) with 404, and won't resolve
  // unlisted videos unless the privacy hash is preserved.
  const candidates: string[] = [videoUrl]
  if (isVimeo) {
    try {
      const v = new URL(videoUrl)
      // Preserve only the unlisted hash if present
      const h = v.searchParams.get('h')
      const cleanPath = v.pathname.replace(/\/+$/, '')
      const clean = `https://vimeo.com${cleanPath}${h ? `?h=${h}` : ''}`
      if (clean !== videoUrl) candidates.push(clean)

      // Also try extracting just the numeric ID as a last resort
      const idMatch = cleanPath.match(/\/(\d+)/)
      if (idMatch) candidates.push(`https://vimeo.com/${idMatch[1]}`)
    } catch {}
  }

  const buildEndpoint = (u: string) =>
    isYouTube
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`

  let lastStatus = 0
  for (const candidate of candidates) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(buildEndpoint(candidate), { signal: controller.signal })
      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        return new Response(
          JSON.stringify({
            title: data.title ?? 'Untitled',
            thumbnailUrl: data.thumbnail_url ?? '',
            provider: isYouTube ? 'YouTube' : 'Vimeo',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      lastStatus = res.status
      await res.text() // drain
    } catch (err) {
      lastStatus = 599
      console.error('[oembed-proxy] fetch error:', err)
    }
  }

  // Graceful fallback — never return 5xx to the client for a missing/private video
  return new Response(
    JSON.stringify({
      error: `Video not available via oEmbed (status ${lastStatus}). It may be private, unlisted without a hash, or removed.`,
      fallback: true,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
