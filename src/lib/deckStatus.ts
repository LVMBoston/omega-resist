/**
 * Per-deck deployment status helpers.
 *
 * "Deployed" is a per-deck property: the timestamp of the most recent
 * successful publish of that deck. See:
 *   docs/decisions/decks/2026-04-25_per-deck-deployment-status_feature-doc_lovable.md
 */

export type DeckDeploymentStatus = "draft" | "live" | "pending";

export interface DeckStatusInput {
  last_deployed_at: string | null;
  last_modified_at: string | null;
  /** True if the deck has at least one EOA assigned OR any L00 token. */
  hasUsage: boolean;
}

export interface DeckStatusResult {
  status: DeckDeploymentStatus;
  lastDeployedAt: Date | null;
  lastModifiedAt: Date | null;
}

export function getDeckDeploymentStatus(input: DeckStatusInput): DeckStatusResult {
  const lastDeployedAt = input.last_deployed_at ? new Date(input.last_deployed_at) : null;
  const lastModifiedAt = input.last_modified_at ? new Date(input.last_modified_at) : null;

  // Draft: never deployed AND not in use
  if (!lastDeployedAt && !input.hasUsage) {
    return { status: "draft", lastDeployedAt, lastModifiedAt };
  }

  // Pending: modified after last deploy (or modified but never deployed yet, while in use)
  if (lastModifiedAt && (!lastDeployedAt || lastModifiedAt.getTime() > lastDeployedAt.getTime())) {
    return { status: "pending", lastDeployedAt, lastModifiedAt };
  }

  // Live: deployed and not modified since
  if (lastDeployedAt) {
    return { status: "live", lastDeployedAt, lastModifiedAt };
  }

  // Fallback (in use but no timestamps yet) — treat as pending
  return { status: "pending", lastDeployedAt, lastModifiedAt };
}

export function formatDeployedTimestamp(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function statusLabel(status: DeckDeploymentStatus): string {
  switch (status) {
    case "draft": return "Draft";
    case "live": return "Live";
    case "pending": return "Pending Deploy";
  }
}

export function statusBadgeClasses(status: DeckDeploymentStatus): string {
  switch (status) {
    case "live":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0";
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0";
    case "draft":
      return "bg-muted text-muted-foreground border-0";
  }
}
