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
  // Basemap label density. 'auto' = labels on desktop, hidden on small screens
  // (rendered width < 500px); 'labels' = always show; 'no_labels' = always hide.
  // Defaults to 'auto' when unset.
  labelDensity?: 'auto' | 'labels' | 'no_labels';
  savedBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  savedCenter?: { lat: number; lng: number };
  savedZoom?: number;
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
  zIndex?: number;  // stacking order (0-99, default 1) — higher = on top when hotspots overlap
  labelPosition?: 'top' | 'bottom';
  url?: string;     // For external_link type
  // App download hotspot properties
  appStoreUrl?: string;   // iOS App Store link
  playStoreUrl?: string;  // Google Play Store link
  fallbackUrl?: string;   // Desktop/other fallback link
  // Live number hotspot properties
  metricKey?: LiveMetricKey;
  manualLabel?: string;  // For manual_entry metric type — plain text fallback
  manualHtml?: string;   // For manual_entry metric type — sanitized rich-text HTML (preferred when present)
  liveNumberStyle?: LiveNumberStyle;
  /**
   * For metricKey === 'campaign_story' only. Controls which slice of the
   * narrative this hotspot renders so landscape decks can place two
   * side-by-side hotspots that together show the full story.
   *   'full'   — entire story (default; portrait behavior)
   *   'first'  — left/top column (includes __TITLE__)
   *   'second' — right/bottom column (includes 'Date of this report:' footer)
   */
  storySegment?: 'full' | 'first' | 'second';
  // Chart hotspot properties
  chartConfig?: ChartConfig;
  // Map hotspot properties
  mapConfig?: MapConfig;
  // Email links hotspot properties
  emailLinksSubject?: string;      // Subject line for mailto
  emailLinksShowLabels?: boolean;  // Show label text on overlay at runtime
  isTransparent?: boolean;         // Hide icon — transparent tap target over slide image
  // Support email hotspot properties
  supportEmail?: string;           // Recipient address for email_support mailto
  supportSubject?: string;         // Optional subject line for email_support mailto
  // Image hotspot properties
  imageSrc?: string;               // Public URL of pasted/uploaded image
  imageNaturalRatio?: number;      // naturalWidth / naturalHeight — used to lock aspect ratio
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
  /**
   * When false, text that overflows the hotspot box is allowed to render
   * outside its bounds (overflow: visible). Defaults to true (clip).
   * Useful for splitting long content (e.g. campaign_story) across two
   * hotspots configured as top- and bottom-aligned "pages".
   */
  clipOverflow?: boolean;
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
  | 'campaign_story'    // Compact campaign narrative headline
  | 'campaign_description' // Campaign description text from campaigns table
  | 'tz_offset_note'   // Dynamic ET offset note (DST-aware)
  | 'map_legend';      // Static visual key for map marker symbols

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
  | 'email_support'    // Mailto to a specific support address with optional subject
  | 'video'            // Unified video player (auto-detects YouTube or Vimeo from URL)
  | 'vimeo'            // @deprecated — use 'video'; kept for backward compat with existing data
  | 'youtube'          // @deprecated — use 'video'; kept for backward compat with existing data
  | 'image';           // Pasted image overlay (locked to natural aspect ratio)
