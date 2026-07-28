/**
 * Tracks the campaign the user is currently working in, so that navigating to
 * another campaign-scoped page (e.g. Campaign Visibility from the sidebar)
 * lands on that campaign instead of a stale remembered one.
 */

const KEY = "active-campaign";

export interface ActiveCampaign {
  id: string;
  code: string;
  title?: string;
}

export function setActiveCampaign(campaign: ActiveCampaign) {
  try {
    localStorage.setItem(KEY, JSON.stringify(campaign));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function getActiveCampaign(): ActiveCampaign | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.code === "string") {
      return parsed as ActiveCampaign;
    }
    return null;
  } catch {
    return null;
  }
}

/** Builds the Campaign Visibility URL for the currently active campaign. */
export function campaignDashboardUrl(): string {
  const active = getActiveCampaign();
  if (!active) return "/campaign-dashboard";
  const params = new URLSearchParams({
    campaign: active.code,
    campaignId: active.id,
  });
  return `/campaign-dashboard?${params.toString()}`;
}
