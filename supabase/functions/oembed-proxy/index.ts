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

  // Detect provider
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(videoUrl)
  const isVimeo = /vimeo\.com/i.test(videoUrl)

  if (!isYouTube && !isVimeo) {
    return new Response(JSON.stringify({ error: 'Unsupported video provider' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const endpoint = isYouTube
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(endpoint, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `oEmbed returned ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const result = {
      title: data.title ?? 'Untitled',
      thumbnailUrl: data.thumbnail_url ?? '',
      provider: isYouTube ? 'YouTube' : 'Vimeo',
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
