export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_aggregates: {
        Row: {
          campaign_id: string | null
          created_at: string
          date: string
          deck_slug: string | null
          eoa_id: string | null
          id: string
          level: number | null
          scans: number | null
          shares: number | null
          unique_tokens: number | null
          updated_at: string
          views: number | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          date: string
          deck_slug?: string | null
          eoa_id?: string | null
          id?: string
          level?: number | null
          scans?: number | null
          shares?: number | null
          unique_tokens?: number | null
          updated_at?: string
          views?: number | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          date?: string
          deck_slug?: string | null
          eoa_id?: string | null
          id?: string
          level?: number | null
          scans?: number | null
          shares?: number | null
          unique_tokens?: number | null
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_aggregates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_aggregates_deck_slug_fkey"
            columns: ["deck_slug"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "daily_aggregates_eoa_id_fkey"
            columns: ["eoa_id"]
            isOneToOne: false
            referencedRelation: "events_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_shares: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          last_viewed_at: string | null
          share_code: string
          view_count: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          last_viewed_at?: string | null
          share_code: string
          view_count?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_viewed_at?: string | null
          share_code?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_dashboard_shares_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_eoa_assignments: {
        Row: {
          assigned_at: string
          deck_slug: string
          deck_version: number
          eoa_id: string
          id: string
        }
        Insert: {
          assigned_at?: string
          deck_slug: string
          deck_version: number
          eoa_id: string
          id?: string
        }
        Update: {
          assigned_at?: string
          deck_slug?: string
          deck_version?: number
          eoa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_eoa_assignments_deck_slug_deck_version_fkey"
            columns: ["deck_slug", "deck_version"]
            isOneToOne: false
            referencedRelation: "deck_versions"
            referencedColumns: ["deck_slug", "version"]
          },
          {
            foreignKeyName: "deck_eoa_assignments_eoa_id_fkey"
            columns: ["eoa_id"]
            isOneToOne: false
            referencedRelation: "events_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_versions: {
        Row: {
          created_at: string
          deck_slug: string
          id: string
          notes: string | null
          version: number
        }
        Insert: {
          created_at?: string
          deck_slug: string
          id?: string
          notes?: string | null
          version: number
        }
        Update: {
          created_at?: string
          deck_slug?: string
          id?: string
          notes?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deck_versions_deck_slug_fkey"
            columns: ["deck_slug"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["slug"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      events_actions: {
        Row: {
          assigned_deck_slug: string | null
          campaign_id: string
          city: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          last_synced_at: string | null
          mobilize_code: string | null
          mobilize_id: string | null
          site_name: string | null
          start_date: string | null
          state: string | null
          timezone: string | null
          title: string
          type: string
          updated_at: string
          utm_content: string | null
          utm_id: string
          zip_code: string | null
        }
        Insert: {
          assigned_deck_slug?: string | null
          campaign_id: string
          city?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          last_synced_at?: string | null
          mobilize_code?: string | null
          mobilize_id?: string | null
          site_name?: string | null
          start_date?: string | null
          state?: string | null
          timezone?: string | null
          title: string
          type: string
          updated_at?: string
          utm_content?: string | null
          utm_id: string
          zip_code?: string | null
        }
        Update: {
          assigned_deck_slug?: string | null
          campaign_id?: string
          city?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          last_synced_at?: string | null
          mobilize_code?: string | null
          mobilize_id?: string | null
          site_name?: string | null
          start_date?: string | null
          state?: string | null
          timezone?: string | null
          title?: string
          type?: string
          updated_at?: string
          utm_content?: string | null
          utm_id?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_actions_assigned_deck_slug_fkey"
            columns: ["assigned_deck_slug"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      shortened_urls: {
        Row: {
          clicks: number
          created_at: string
          created_by: string | null
          full_url: string
          id: string
          short_code: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          created_by?: string | null
          full_url: string
          id?: string
          short_code: string
        }
        Update: {
          clicks?: number
          created_at?: string
          created_by?: string | null
          full_url?: string
          id?: string
          short_code?: string
        }
        Relationships: []
      }
      slide_items: {
        Row: {
          content_url: string
          created_at: string
          deck_slug: string
          id: string
          import_source: string | null
          is_compressed: boolean | null
          position: number
          template_id: string | null
          type: string
        }
        Insert: {
          content_url: string
          created_at?: string
          deck_slug: string
          id?: string
          import_source?: string | null
          is_compressed?: boolean | null
          position: number
          template_id?: string | null
          type?: string
        }
        Update: {
          content_url?: string
          created_at?: string
          deck_slug?: string
          id?: string
          import_source?: string | null
          is_compressed?: boolean | null
          position?: number
          template_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_items_deck_slug_fkey"
            columns: ["deck_slug"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "slide_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "viral_slide_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          created_by: string | null
          deck_slug: string
          deck_version_at_mint: string | null
          deleted_at: string | null
          eoa_id: string
          full_url: string
          id: string
          is_simulated: boolean
          level: number
          minted_at: string
          parent_token: string | null
          root_token: string | null
          token: string
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_by?: string | null
          deck_slug: string
          deck_version_at_mint?: string | null
          deleted_at?: string | null
          eoa_id: string
          full_url: string
          id?: string
          is_simulated?: boolean
          level: number
          minted_at?: string
          parent_token?: string | null
          root_token?: string | null
          token: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_by?: string | null
          deck_slug?: string
          deck_version_at_mint?: string | null
          deleted_at?: string | null
          eoa_id?: string
          full_url?: string
          id?: string
          is_simulated?: boolean
          level?: number
          minted_at?: string
          parent_token?: string | null
          root_token?: string | null
          token?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tokens_deck_slug_fkey"
            columns: ["deck_slug"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "tokens_eoa_id_fkey"
            columns: ["eoa_id"]
            isOneToOne: false
            referencedRelation: "events_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_parent_token_fkey"
            columns: ["parent_token"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["token"]
          },
          {
            foreignKeyName: "tokens_root_token_fkey"
            columns: ["root_token"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["token"]
          },
        ]
      }
      url_events: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          deleted_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          is_simulated: boolean
          latitude: number | null
          longitude: number | null
          occurred_at: string
          region: string | null
          token: string
          user_agent: string | null
          utm_snapshot: Json | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          deleted_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          is_simulated?: boolean
          latitude?: number | null
          longitude?: number | null
          occurred_at?: string
          region?: string | null
          token: string
          user_agent?: string | null
          utm_snapshot?: Json | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          deleted_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          is_simulated?: boolean
          latitude?: number | null
          longitude?: number | null
          occurred_at?: string
          region?: string | null
          token?: string
          user_agent?: string | null
          utm_snapshot?: Json | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "url_events_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["token"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viral_slide_configs: {
        Row: {
          config: Json | null
          created_at: string
          deck_slug: string | null
          description: string | null
          hotspots: Json | null
          id: string
          image_url: string
          is_default: boolean | null
          name: string | null
          slide_id: string | null
          slug: string
          template_type: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          deck_slug?: string | null
          description?: string | null
          hotspots?: Json | null
          id?: string
          image_url: string
          is_default?: boolean | null
          name?: string | null
          slide_id?: string | null
          slug: string
          template_type?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          deck_slug?: string | null
          description?: string | null
          hotspots?: Json | null
          id?: string
          image_url?: string
          is_default?: boolean | null
          name?: string | null
          slide_id?: string | null
          slug?: string
          template_type?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viral_slide_configs_deck_slug_fkey"
            columns: ["deck_slug"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "viral_slide_configs_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slide_items"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_codes: {
        Row: {
          city: string | null
          created_at: string | null
          latitude: number
          longitude: number
          state_id: string | null
          state_name: string | null
          timezone: string | null
          zip_code: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          latitude: number
          longitude: number
          state_id?: string | null
          state_name?: string | null
          timezone?: string | null
          zip_code: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          latitude?: number
          longitude?: number
          state_id?: string | null
          state_name?: string | null
          timezone?: string | null
          zip_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_share_code: { Args: never; Returns: string }
      generate_short_code: { Args: never; Returns: string }
      generate_token: { Args: never; Returns: string }
      get_coordinates_from_zip: {
        Args: { p_zip_code: string }
        Returns: {
          city: string
          latitude: number
          longitude: number
          state_name: string
          timezone: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_token_valid: { Args: { p_token: string }; Returns: boolean }
      log_event:
        | {
            Args: {
              _city?: string
              _country?: string
              _country_code?: string
              _event_type: string
              _ip_address?: unknown
              _latitude?: number
              _longitude?: number
              _region?: string
              _token: string
              _user_agent?: string
              _utm_snapshot?: Json
              _zip_code?: string
            }
            Returns: string
          }
        | {
            Args: {
              _event_type: string
              _ip_address?: unknown
              _token: string
              _user_agent?: string
              _utm_snapshot?: Json
            }
            Returns: string
          }
      lookup_token: {
        Args: { _token: string }
        Returns: {
          deck_slug: string
          full_url: string
          level: number
          token: string
        }[]
      }
      mint_l00: {
        Args: { _deck_slug: string; _eoa_id: string; _utm_medium?: string }
        Returns: {
          full_url: string
          token: string
        }[]
      }
      mint_share: {
        Args: { _parent_token: string; _utm_medium: string }
        Returns: {
          full_url: string
          level: number
          token: string
        }[]
      }
      refresh_daily_aggregates: { Args: never; Returns: undefined }
      shorten_url: {
        Args: { _full_url: string }
        Returns: {
          short_code: string
          short_url: string
        }[]
      }
      track_redirect: { Args: { _short_code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "manager" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "viewer"],
    },
  },
} as const
