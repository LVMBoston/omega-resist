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
  | 'custom_action';      // Future: custom actions (e.g., form, quiz)

// Base config (extensible)
export type TemplateConfig = 
  | InteractiveShareConfig
  | DisplayOnlyConfig
  | CustomActionConfig;

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
}

// Hotspot action types (can expand for custom_action)
export type HotspotActionType = 
  | 'sms' 
  | 'email' 
  | 'social'
  | 'external_link'    // Future: link to external URL
  | 'form_trigger'     // Future: open embedded form
  | 'custom';          // Future: custom action
