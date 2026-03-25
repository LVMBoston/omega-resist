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
  | 'stats_page'          // Data template: live metrics overlay
  | 'hybrid';             // Hybrid: data hotspots + action hotspots on one slide

// Base config (extensible)
export type TemplateConfig = 
  | InteractiveShareConfig
  | DisplayOnlyConfig
  | CustomActionConfig
  | StatsPageConfig
  | HybridConfig;

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

// Hybrid config (combined data + action on one slide)
export interface HybridConfig {
  type: 'hybrid';
  sourceActionTemplateId?: string;  // ID of the Action template this was promoted from
  dataSettings?: {
    refreshIntervalSeconds?: number;
    animateChanges?: boolean;
    formatLocale?: string;
  };
}

// Chart configuration for chart hotspots
export interface ChartConfig {
  chartType: 'stacked_bar';
  dataSource: 'cumulative_opens_by_level';
  showXAxis?: boolean;  // default true
  showYAxis?: boolean;  // default false
}

// Map configuration for map hotspots
export interface MapConfig {
  mapStyle: 'channel_colors';  // Future: 'level_colors' | 'single_color'
  showClustering: boolean;
  showSpawnHighlight?: boolean;  // Show green border on seeds with spawns
  isLocked?: boolean;  // Lock map positioning in editor
  savedBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
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
  // App download hotspot properties
  appStoreUrl?: string;   // iOS App Store link
  playStoreUrl?: string;  // Google Play Store link
  fallbackUrl?: string;   // Desktop/other fallback link
  // Live number hotspot properties
  metricKey?: LiveMetricKey;
  manualLabel?: string;  // For manual_entry metric type
  liveNumberStyle?: LiveNumberStyle;
  // Chart hotspot properties
  chartConfig?: ChartConfig;
  // Map hotspot properties
  mapConfig?: MapConfig;
  // Email links hotspot properties
  emailLinksSubject?: string;      // Subject line for mailto
  emailLinksShowLabels?: boolean;  // Show label text on overlay at runtime
  isTransparent?: boolean;         // Hide icon — transparent tap target over slide image
}

// Live number style configuration
export interface LiveNumberStyle {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  fontFamily?: string;
  padding?: string;
  borderRadius?: string;
}

// Available metrics for live_number hotspots
export type LiveMetricKey = 
  | 'manual_entry'      // User-defined manual text
  | 'seeds'             // Count of L00 tokens
  | 'seeds_with_spawns' // Count of L00 tokens that have child shares
  | 'shares'            // Count of child tokens minted
  | 'opens'             // Total view events
  | 'opens_us'          // US-based views
  | 'opens_intl'        // International views
  | 'opens_qr'          // Opens via QR scan
  | 'opens_text'        // Opens via text/SMS
  | 'opens_mail'        // Opens via email
  | 'neighborhoods'     // Distinct zip codes
  | 'depth'             // Max level reached
  | 'l01_count'         // Count at level 1
  | 'l02_count'         // Count at level 2
  | 'l03_count'         // Count at level 3
  | 'viral_coefficient' // K-factor
  | 'campaign_name'     // Campaign title text
  | 'current_date'      // Current date (viewer's local TZ)
  | 'current_time'      // Current time (viewer's local TZ)
  | 'earliest_active'   // Earliest activity timestamp (viewer's local TZ)
  | 'latest_active'     // Latest activity timestamp (viewer's local TZ)
  | 'last_updated'      // When snapshot was last rendered (for SSR)
  | 'campaign_story';   // Compact campaign narrative headline

// Hotspot action types (can expand for custom_action)
export type HotspotActionType = 
  | 'sms' 
  | 'email' 
  | 'social'
  | 'external_link'    // Future: link to external URL
  | 'form_trigger'     // Future: open embedded form
  | 'custom'           // Future: custom action
  | 'live_number'      // Live metrics overlay
  | 'chart'            // Chart visualization
  | 'map'              // Map visualization
  | 'app_download'     // Universal app store redirect
  | 'email_links'      // Bundle sibling external_link URLs into mailto
  | 'vimeo';           // Inline Vimeo video player
