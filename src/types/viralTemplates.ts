// Base template interface
export interface ViralTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string;
  template_type: TemplateType;
  config: TemplateConfig;
  hotspots: Hotspot[];
  is_default: boolean;
  deck_slug: string | null;
  created_at: string;
  updated_at: string;
}

// Template type enum
export type TemplateType = 
  | 'interactive_share'   // Default: L01-L03 viral share hotspots
  | 'display_only'        // No interactivity, just display
  | 'custom_action'       // Future: custom actions (e.g., form, quiz)
  | 'stats_page';         // Data template: live metrics overlay

// Base config (extensible)
export type TemplateConfig = 
  | InteractiveShareConfig
  | DisplayOnlyConfig
  | CustomActionConfig
  | StatsPageConfig;

// Interactive share config (current functionality)
export interface InteractiveShareConfig {
  type: 'interactive_share';
  shareSettings?: {
    enableSMS?: boolean;
    enableEmail?: boolean;
    enableSocial?: boolean;
    customShareMessage?: string;
  };
}

// Display only config (new type)
export interface DisplayOnlyConfig {
  type: 'display_only';
  displaySettings?: {
    autoAdvanceSeconds?: number;
    allowManualAdvance?: boolean;
    loopOnEnd?: boolean;
  };
}

// Custom action config (future extensibility)
export interface CustomActionConfig {
  type: 'custom_action';
  actionDefinition?: {
    actionType: string;
    payload: Record<string, any>;
  };
}

// Stats page config (data template with live metrics)
export interface StatsPageConfig {
  type: 'stats_page';
  dataSettings?: {
    refreshIntervalSeconds?: number;
    animateChanges?: boolean;
    formatLocale?: string;
  };
}

// Hotspot interface
export interface Hotspot {
  id: string;
  iconId: string;
  type: HotspotActionType;
  label: string;
  x: number;        // percentage (0-100)
  y: number;        // percentage (0-100)
  width: number;    // percentage
  height: number;   // percentage
  labelPosition?: 'top' | 'bottom';
  url?: string;     // For external_link type
  // Live number hotspot properties
  metricKey?: LiveMetricKey;
  liveNumberStyle?: LiveNumberStyle;
}

// Live number style configuration
export interface LiveNumberStyle {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontFamily?: string;
  padding?: string;
  borderRadius?: string;
}

// Available metrics for live_number hotspots
export type LiveMetricKey = 
  | 'seeds'           // Count of L00 tokens
  | 'shares'          // Count of child tokens minted
  | 'opens'           // Total view events
  | 'opens_us'        // US-based views
  | 'opens_intl'      // International views
  | 'opens_qr'        // Opens via QR scan
  | 'opens_text'      // Opens via text/SMS
  | 'opens_mail'      // Opens via email
  | 'neighborhoods'   // Distinct zip codes
  | 'depth'           // Max level reached
  | 'l01_count'       // Count at level 1
  | 'l02_count'       // Count at level 2
  | 'l03_count'       // Count at level 3
  | 'viral_coefficient' // K-factor
  | 'campaign_name'   // Campaign title text
  | 'start_date'      // Campaign start date
  | 'current_date'    // Current date
  | 'start_time'      // Campaign start time
  | 'current_time';   // Current time

// Hotspot action types (can expand for custom_action)
export type HotspotActionType = 
  | 'sms' 
  | 'email' 
  | 'social'
  | 'external_link'    // Future: link to external URL
  | 'form_trigger'     // Future: open embedded form
  | 'custom'           // Future: custom action
  | 'live_number';     // Live metrics overlay
