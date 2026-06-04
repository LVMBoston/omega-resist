import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Tone = "urgent" | "informative" | "hopeful" | "defiant";
type Mode = "suggest_field" | "synthesize_description" | "suggest_title";
type FieldKey = "what" | "why" | "when" | "where" | "who" | "ask";

interface Brief {
  what?: string;
  why?: string;
  when?: string;
  where?: string;
  who?: string;
  ask?: string;
  key_facts?: string[];
  do_not_say?: string[];
  tone?: Tone;
}

interface Body {
  mode: Mode;
  campaignTitle?: string;
  brief?: Brief;
  field?: FieldKey; // required when mode === "suggest_field"
}

const FIELD_GUIDANCE: Record<FieldKey, string> = {
  what: "One concrete sentence describing the event or action. Active voice. No buzzwords.",
  why: "Two sentences max on why this matters now — the stakes, who is affected, what is at risk.",
  when: "Plain date/time, or 'ongoing' / 'nationwide'. No filler.",
  where: "Locations, scope, or 'nationwide'. Mention the geographic level (city/state/country).",
  who: "One sentence naming the audience the ask is aimed at (e.g. 'registered voters in swing states').",
  ask: "One sentence stating the concrete call to action (sign up, show up, share, donate, contact a rep).",
};

function briefToContext(b: Brief | undefined): string {
  if (!b) return "(no brief yet)";
  const lines: string[] = [];
  if (b.what) lines.push(`What: ${b.what}`);
  if (b.why) lines.push(`Why it matters: ${b.why}`);
  if (b.when) lines.push(`When: ${b.when}`);
  if (b.where) lines.push(`Where: ${b.where}`);
  if (b.who) lines.push(`Audience: ${b.who}`);
  if (b.ask) lines.push(`The ask: ${b.ask}`);
  if (b.key_facts?.length) lines.push(`Key facts to include:\n- ${b.key_facts.join("\n- ")}`);
  if (b.do_not_say?.length) lines.push(`Do NOT say:\n- ${b.do_not_say.join("\n- ")}`);
  if (b.tone) lines.push(`Tone: ${b.tone}`);
  return lines.length ? lines.join("\n") : "(no brief yet)";
}

function buildPrompt(b: Body): { system: string; user: string } {
  const ctx = briefToContext(b.brief);
  const title = b.campaignTitle?.trim() || "(untitled campaign)";

  if (b.mode === "suggest_field") {
    const f = b.field!;
    return {
      system: [
        "You help organizers fill out a structured brief for a grassroots civic campaign.",
        `You are drafting ONLY the "${f}" field.`,
        FIELD_GUIDANCE[f],
        "Plain text only. No markdown, no quotes, no labels. Return ONLY the field's value.",
      ].join("\n"),
      user: `Campaign name: ${title}\n\nWhat is already known:\n${ctx}\n\nDraft a strong "${f}" value now.`,
    };
  }

  if (b.mode === "synthesize_description") {
    return {
      system: [
        "You synthesize a clear, plainspoken campaign description from a structured brief.",
        "Write 2–4 short sentences. No headings, no bullets, no markdown.",
        "Lead with what is happening and why it matters. End with the ask.",
        "Never invent facts. If the brief omits a detail, omit it from the description.",
        "Return ONLY the description.",
      ].join("\n"),
      user: `Campaign name: ${title}\n\nBrief:\n${ctx}\n\nWrite the description now.`,
    };
  }

  // suggest_title
  return {
    system: [
      "You suggest a concise, memorable campaign name from a structured brief.",
      "Max 6 words. Title case. No punctuation other than commas or em-dashes.",
      "Avoid clichés ('Stand Up', 'Rise Up', 'Together We…'). Be concrete.",
      "Return ONLY the name. No quotes, no commentary.",
    ].join("\n"),
    user: `Current name: ${title}\n\nBrief:\n${ctx}\n\nSuggest a better name now.`,
  };
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
    if (!raw.mode || !["suggest_field", "synthesize_description", "suggest_title"].includes(raw.mode)) {
      errors.push("invalid mode");
    }
    if (raw.mode === "suggest_field") {
      if (!raw.field || !["what", "why", "when", "where", "who", "ask"].includes(raw.field)) {
        errors.push("invalid or missing field");
      }
    }
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
    let text: string = (data?.choices?.[0]?.message?.content ?? "").trim();
    // Strip wrapping quotes if any
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }
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
    console.error("draft-campaign-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
