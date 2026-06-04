import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Channel = "sms" | "email";
type Level = "l00" | "l01";
type Tone = "urgent" | "informative" | "hopeful" | "defiant";

interface Body {
  campaignTitle: string;
  campaignDescription: string;
  tone: Tone;
  channel: Channel;
  level: Level;
}

const TONE_GUIDANCE: Record<Tone, string> = {
  urgent: "Urgent — convey time-sensitivity and stakes; direct and active voice; no melodrama.",
  informative: "Informative — calm, clear, plainspoken; explain what this is and why it matters.",
  hopeful: "Hopeful — warm, encouraging, agency-affirming; light use of emoji is OK (1 max).",
  defiant: "Defiant — confident, plainspoken, refuses the regime's framing; principled, not angry.",
};

function buildPrompt(b: Body): { system: string; user: string } {
  const isSMS = b.channel === "sms";
  const lengthRule = isSMS
    ? "MUST be 280 characters or fewer (including the {{link}} placeholder). No subject line."
    : "Write 2–4 short paragraphs. Place {{link}} on its own line where the reader is invited to act. No subject line, no signature.";

  const audience =
    b.level === "l00"
      ? "You are writing as the campaign organizer, sending this directly to a friend or contact who has never seen this campaign before."
      : "You are writing as someone who just received this from a friend and is forwarding it to their own contacts (one degree out). Acknowledge that framing naturally (e.g. 'A friend shared this with me…') without sounding scripted.";

  const system = [
    `You draft short outreach messages for grassroots civic campaigns.`,
    audience,
    `Channel: ${b.channel.toUpperCase()}. Level: ${b.level.toUpperCase()}.`,
    lengthRule,
    `Allowed placeholders: {{link}}, {{city}}, {{state}}, {{site_name}}. Use {{link}} exactly once. Never invent other {{...}} tokens.`,
    `Plain text only — no markdown, no headings, no bullet lists.`,
    `${TONE_GUIDANCE[b.tone]}`,
    `Return ONLY the message body. Do not add commentary, quotes, or labels like "SMS:".`,
  ].join("\n");

  const user = `Campaign name: ${b.campaignTitle}\n\nCampaign description:\n${b.campaignDescription}\n\nDraft the message now.`;
  return { system, user };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = (await req.json()) as Partial<Body>;
    const errors: string[] = [];
    if (!raw.campaignTitle?.trim()) errors.push("campaignTitle is required");
    if (!raw.campaignDescription?.trim()) errors.push("campaignDescription is required");
    if (!raw.tone || !["urgent", "informative", "hopeful", "defiant"].includes(raw.tone)) errors.push("invalid tone");
    if (!raw.channel || !["sms", "email"].includes(raw.channel)) errors.push("invalid channel");
    if (!raw.level || !["l00", "l01"].includes(raw.level)) errors.push("invalid level");
    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join("; ") }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = raw as Body;
    const { system, user } = buildPrompt(body);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded — please wait a moment and try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const text: string = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "Empty response from AI" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("draft-campaign-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
