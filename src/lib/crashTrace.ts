// Persistent crash-trace ring buffer.
// Survives full page reloads via sessionStorage so we can see what happened
// in the previous "life" of the tab even after the React app gets nuked.

const KEY = "samizdat:crash-trace";
const MAX_ENTRIES = 400;

type Entry = { t: number; tag: string; msg: string };

function read(): Entry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Entry[];
  } catch {
    return [];
  }
}

function write(entries: Entry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota — ignore */
  }
}

export function traceLog(tag: string, ...parts: unknown[]) {
  const msg = parts
    .map((p) => {
      if (typeof p === "string") return p;
      try {
        return JSON.stringify(p, (_, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v));
      } catch {
        return String(p);
      }
    })
    .join(" ");
  const entry: Entry = { t: Date.now(), tag, msg };
  const entries = read();
  entries.push(entry);
  write(entries);
  // Also mirror to console with a recognisable prefix
  // eslint-disable-next-line no-console
  console.log(`[trace:${tag}]`, ...parts);
}

export function dumpPreviousTrace() {
  const entries = read();
  if (entries.length === 0) return;
  // eslint-disable-next-line no-console
  console.group(`%c[crashTrace] ${entries.length} entries from previous life`, "color:#c00;font-weight:bold");
  for (const e of entries) {
    const dt = new Date(e.t).toISOString().slice(11, 23);
    // eslint-disable-next-line no-console
    console.log(`${dt} [${e.tag}] ${e.msg}`);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export function clearTrace() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
