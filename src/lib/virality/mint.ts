import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const MintL00Input = z.object({
  eoaId: z.string().uuid(),
  deckSlug: z.string().min(1),
  utmMedium: z.enum(["qr", "em", "sms", "social", "p2p"]),
  utmContent: z.string().optional()
});

const MintL00Output = z.object({ 
  token: z.string(), 
  full_url: z.string().url() 
});

export async function mintL00(input: z.infer<typeof MintL00Input>) {
  const { eoaId, deckSlug, utmMedium, utmContent } = MintL00Input.parse(input);
  
  const { data, error } = await supabase.rpc("mint_l00", {
    _eoa_id: eoaId,
    _deck_slug: deckSlug,
    _utm_medium: utmMedium,
    _utm_content: utmContent ?? null
  });
  
  if (error) {
    console.error("mint_l00 error:", error);
    throw new Error("DECK_VIRAL_MINT_L00_FAILED: " + error.message);
  }
  
  // RPC returns array of rows, get first row
  const result = Array.isArray(data) ? data[0] : data;
  return MintL00Output.parse(result);
}

const MintShareInput = z.object({
  parentToken: z.string().min(1),
  utmMedium: z.enum(["qr", "em", "sms", "social", "p2p"])
});

const MintShareOutput = z.object({ 
  token: z.string(), 
  full_url: z.string().url(), 
  level: z.number().int().min(1).max(3) 
});

export async function mintShare(input: z.infer<typeof MintShareInput>) {
  const { parentToken, utmMedium } = MintShareInput.parse(input);
  
  const { data, error } = await supabase.rpc("mint_share", {
    _parent_token: parentToken,
    _utm_medium: utmMedium
  });
  
  if (error) {
    console.error("mint_share error:", error);
    throw new Error("DECK_VIRAL_MINT_SHARE_FAILED: " + error.message);
  }
  
  // RPC returns array of rows, get first row
  const result = Array.isArray(data) ? data[0] : data;
  return MintShareOutput.parse(result);
}

const LogEventInput = z.object({
  token: z.string(),
  eventType: z.enum(["scan", "view", "share"]),
  utmSnapshot: z.record(z.any()).optional(),
  ip: z.string().optional(),
  ua: z.string().optional()
});

export async function logEvent(input: z.infer<typeof LogEventInput>) {
  const { token, eventType, utmSnapshot, ip, ua } = LogEventInput.parse(input);
  
  const { data, error } = await supabase.rpc("log_event", {
    _token: token,
    _event_type: eventType,
    _utm_snapshot: utmSnapshot ?? null,
    _ip_address: ip ?? null,
    _user_agent: ua ?? null
  });
  
  if (error) {
    console.error("log_event error:", error);
    throw new Error("DECK_VIRAL_LOG_EVENT_FAILED: " + error.message);
  }
  
  return data; // event_id
}
