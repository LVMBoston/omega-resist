const LAST_TEMPLATE_EDITOR_ROUTE_KEY = "samizdat:last-template-editor-route";
const TEMPLATE_EDITOR_EXIT_INTENT_KEY = "samizdat:template-editor-intentional-exit";

const IMMEDIATE_BOUNCE_MS = 30 * 1000;

type StoredEditorRoute = {
  path: string;
  at: number;
};

const safeSessionStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function rememberTemplateEditorRoute(path = `${window.location.pathname}${window.location.search}`) {
  if (!path.startsWith("/template-editor/")) return;

  const storage = safeSessionStorage();
  if (!storage) return;

  const value: StoredEditorRoute = { path, at: Date.now() };
  storage.setItem(LAST_TEMPLATE_EDITOR_ROUTE_KEY, JSON.stringify(value));
  storage.removeItem(TEMPLATE_EDITOR_EXIT_INTENT_KEY);
}

export function markTemplateEditorExitIntent() {
  const storage = safeSessionStorage();
  if (!storage) return;

  storage.setItem(TEMPLATE_EDITOR_EXIT_INTENT_KEY, String(Date.now()));
}

export function clearTemplateEditorRecovery() {
  const storage = safeSessionStorage();
  if (!storage) return;

  storage.removeItem(LAST_TEMPLATE_EDITOR_ROUTE_KEY);
  storage.removeItem(TEMPLATE_EDITOR_EXIT_INTENT_KEY);
}

export function getRecoverableTemplateEditorRoute(maxAgeMs = IMMEDIATE_BOUNCE_MS): string | null {
  const storage = safeSessionStorage();
  if (!storage) return null;

  const intentionalExitAt = Number(storage.getItem(TEMPLATE_EDITOR_EXIT_INTENT_KEY) || 0);
  if (intentionalExitAt && Date.now() - intentionalExitAt < maxAgeMs) {
    clearTemplateEditorRecovery();
    return null;
  }

  const raw = storage.getItem(LAST_TEMPLATE_EDITOR_ROUTE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredEditorRoute>;
    if (!parsed.path?.startsWith("/template-editor/")) return null;
    if (!parsed.at || Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.path;
  } catch {
    clearTemplateEditorRecovery();
    return null;
  }
}