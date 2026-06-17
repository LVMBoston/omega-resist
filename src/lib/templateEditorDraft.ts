import type { Hotspot } from "@/types/viralTemplates";

/**
 * Lightweight per-template draft autosave to localStorage. Protects against
 * Lovable preview iframe reloads that throw away in-memory React state before
 * the next debounced DB auto-save fires.
 *
 * Key shape: samizdat:template-editor-draft:<templateId|new>
 * Value: { savedAt, name, slug, description, imageUrl, hotspots }
 *
 * Draft is cleared on successful save and ignored if older than MAX_AGE_MS.
 */

const KEY_PREFIX = "samizdat:template-editor-draft:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
export const DRAFT_SCHEMA_VERSION = 1;

export type TemplateDraft = {
  schemaVersion: number;
  savedAt: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  hotspots: Hotspot[];
};

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function draftKey(templateId: string | undefined): string {
  return `${KEY_PREFIX}${templateId || "new"}`;
}

export function saveTemplateDraft(
  templateId: string | undefined,
  draft: Omit<TemplateDraft, "savedAt" | "schemaVersion">
): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const payload: TemplateDraft = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      savedAt: Date.now(),
      ...draft,
    };
    storage.setItem(draftKey(templateId), JSON.stringify(payload));
  } catch {
    // Quota or serialization error — silent; draft is best-effort.
  }
}

export function loadTemplateDraft(templateId: string | undefined): TemplateDraft | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(draftKey(templateId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TemplateDraft;
    if (parsed.schemaVersion !== DRAFT_SCHEMA_VERSION) {
      storage.removeItem(draftKey(templateId));
      return null;
    }
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      storage.removeItem(draftKey(templateId));
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(draftKey(templateId));
    return null;
  }
}

export function clearTemplateDraft(templateId: string | undefined): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(draftKey(templateId));
  } catch {
    /* noop */
  }
}
