export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          count: number | null
          id: string
          latitude: number | null
          location_id: number | null
          location_name: string | null
          longitude: number | null
          observation_id: string | null
          observed_at: string | null
          observer_name: string | null
          observer_user_id: string | null
          recipient_count: number | null
          sent_at: string
          species_id: number | null
          species_name: string | null
        }
        Insert: {
          count?: number | null
          id?: string
          latitude?: number | null
          location_id?: number | null
          location_name?: string | null
          longitude?: number | null
          observation_id?: string | null
          observed_at?: string | null
          observer_name?: string | null
          observer_user_id?: string | null
          recipient_count?: number | null
          sent_at?: string
          species_id?: number | null
          species_name?: string | null
        }
        Update: {
          count?: number | null
          id?: string
          latitude?: number | null
          location_id?: number | null
          location_name?: string | null
          longitude?: number | null
          observation_id?: string | null
          observed_at?: string | null
          observer_name?: string | null
          observer_user_id?: string | null
          recipient_count?: number | null
          sent_at?: string
          species_id?: number | null
          species_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_name: string
          body_html: string
          category_id: number | null
          cover_media_id: number | null
          created_at: string
          excerpt: string
          id: number
          published_at: string | null
          search: unknown
          slug: string
          status: string
          title: string
          updated_at: string
          wp_id: number | null
        }
        Insert: {
          author_name?: string
          body_html?: string
          category_id?: number | null
          cover_media_id?: number | null
          created_at?: string
          excerpt?: string
          id?: never
          published_at?: string | null
          search?: unknown
          slug: string
          status?: string
          title: string
          updated_at?: string
          wp_id?: number | null
        }
        Update: {
          author_name?: string
          body_html?: string
          category_id?: number | null
          cover_media_id?: number | null
          created_at?: string
          excerpt?: string
          id?: never
          published_at?: string | null
          search?: unknown
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          wp_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          body_html: string
          contact_name: string
          contact_phone: string
          created_at: string
          ends_at: string | null
          id: number
          kind: string
          place: string
          published_at: string | null
          registration_url: string | null
          signup_deadline: string | null
          slug: string
          starts_at: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          body_html?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          ends_at?: string | null
          id?: never
          kind?: string
          place?: string
          published_at?: string | null
          registration_url?: string | null
          signup_deadline?: string | null
          slug: string
          starts_at: string
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          body_html?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          ends_at?: string | null
          id?: never
          kind?: string
          place?: string
          published_at?: string | null
          registration_url?: string | null
          signup_deadline?: string | null
          slug?: string
          starts_at?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      expo_push_tokens: {
        Row: {
          created_at: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_alerts: {
        Row: {
          alert_id: string
          hidden_at: string
          hidden_by: string | null
          reason: string
        }
        Insert: {
          alert_id: string
          hidden_at?: string
          hidden_by?: string | null
          reason?: string
        }
        Update: {
          alert_id?: string
          hidden_at?: string
          hidden_by?: string | null
          reason?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: number
          latitude: number | null
          longitude: number | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          alt: string
          bytes: number
          created_at: string
          format: string
          height: number
          id: number
          storage_prefix: string
          width: number
          widths: number[]
        }
        Insert: {
          alt?: string
          bytes?: number
          created_at?: string
          format: string
          height: number
          id?: never
          storage_prefix: string
          width: number
          widths: number[]
        }
        Update: {
          alt?: string
          bytes?: number
          created_at?: string
          format?: string
          height?: number
          id?: never
          storage_prefix?: string
          width?: number
          widths?: number[]
        }
        Relationships: []
      }
      membership_settings: {
        Row: {
          bankgiro: string
          contact_email: string
          contact_name: string
          contact_phone: string
          fee_adult: number
          fee_family: number
          fee_youth: number
          id: boolean
          swish: string
          updated_at: string
          year: number
          youth_max_age: number
        }
        Insert: {
          bankgiro?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          fee_adult: number
          fee_family: number
          fee_youth: number
          id?: boolean
          swish?: string
          updated_at?: string
          year: number
          youth_max_age: number
        }
        Update: {
          bankgiro?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          fee_adult?: number
          fee_family?: number
          fee_youth?: number
          id?: boolean
          swish?: string
          updated_at?: string
          year?: number
          youth_max_age?: number
        }
        Relationships: []
      }
      observations: {
        Row: {
          activity: string | null
          alert_requested: boolean
          comment: string | null
          count: number
          created_at: string
          id: string
          image_path: string | null
          latitude: number | null
          location_id: number | null
          longitude: number | null
          observed_at: string
          species_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: string | null
          alert_requested?: boolean
          comment?: string | null
          count?: number
          created_at?: string
          id?: string
          image_path?: string | null
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          observed_at: string
          species_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: string | null
          alert_requested?: boolean
          comment?: string | null
          count?: number
          created_at?: string
          id?: string
          image_path?: string | null
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          observed_at?: string
          species_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_location_id_locations_id_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_species_id_species_id_fk"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          body_html: string
          created_at: string
          description: string
          id: number
          kind: string
          link_url: string | null
          parent_id: number | null
          published_at: string | null
          search: unknown
          show_in_menu: boolean
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          wp_id: number | null
        }
        Insert: {
          body_html?: string
          created_at?: string
          description?: string
          id?: never
          kind?: string
          link_url?: string | null
          parent_id?: number | null
          published_at?: string | null
          search?: unknown
          show_in_menu?: boolean
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          wp_id?: number | null
        }
        Update: {
          body_html?: string
          created_at?: string
          description?: string
          id?: never
          kind?: string
          link_url?: string | null
          parent_id?: number | null
          published_at?: string | null
          search?: unknown
          show_in_menu?: boolean
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          wp_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          is_admin: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          is_admin?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          is_admin?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      species: {
        Row: {
          created_at: string
          family: string | null
          id: number
          rarity: number | null
          scientific_name: string
          sort_order: number
          swedish_name: string
        }
        Insert: {
          created_at?: string
          family?: string | null
          id?: number
          rarity?: number | null
          scientific_name: string
          sort_order?: number
          swedish_name: string
        }
        Update: {
          created_at?: string
          family?: string | null
          id?: number
          rarity?: number | null
          scientific_name?: string
          sort_order?: number
          swedish_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    Enums: {},
  },
} as const
