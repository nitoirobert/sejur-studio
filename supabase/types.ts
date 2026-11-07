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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          adults: number
          check_in: string
          check_out: string
          children: number
          created_at: string
          currency: string
          external_uid: string | null
          guest_id: string | null
          hold_expires_at: string | null
          ical_feed_id: string | null
          id: string
          organization_id: string
          public_token: string
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          stay: unknown
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          total_amount: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          adults?: number
          check_in: string
          check_out: string
          children?: number
          created_at?: string
          currency?: string
          external_uid?: string | null
          guest_id?: string | null
          hold_expires_at?: string | null
          ical_feed_id?: string | null
          id?: string
          organization_id: string
          public_token?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          stay?: unknown
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          adults?: number
          check_in?: string
          check_out?: string
          children?: number
          created_at?: string
          currency?: string
          external_uid?: string | null
          guest_id?: string | null
          hold_expires_at?: string | null
          ical_feed_id?: string | null
          id?: string
          organization_id?: string
          public_token?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          stay?: unknown
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_ical_feed_id_fkey"
            columns: ["ical_feed_id"]
            isOneToOne: false
            referencedRelation: "ical_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_feeds: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_status: string | null
          last_sync_at: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["ical_provider"]
          unit_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["ical_provider"]
          unit_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["ical_provider"]
          unit_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_feeds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_feeds_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_address: string | null
          country: string
          created_at: string
          cui: string | null
          id: string
          legal_name: string | null
          name: string
          reg_com: string | null
          slug: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          country?: string
          created_at?: string
          cui?: string | null
          id?: string
          legal_name?: string | null
          name: string
          reg_com?: string | null
          slug: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          country?: string
          created_at?: string
          cui?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          reg_com?: string | null
          slug?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          organization_id: string
          refunded_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          organization_id: string
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          is_cover: boolean
          organization_id: string
          position: number
          property_id: string
          storage_path: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          organization_id: string
          position?: number
          property_id: string
          storage_path: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          organization_id?: string
          position?: number
          property_id?: string
          storage_path?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: Json
          cancellation_policy_id: string | null
          check_in_time: string
          check_out_time: string
          checkin_instructions: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: Json
          cancellation_policy_id?: string | null
          check_in_time?: string
          check_out_time?: string
          checkin_instructions?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: Json
          cancellation_policy_id?: string | null
          check_in_time?: string
          check_out_time?: string
          checkin_instructions?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_conflicts: {
        Row: {
          booking_id: string | null
          conflict_range: unknown
          created_at: string
          external_uid: string | null
          feed_id: string | null
          id: string
          organization_id: string
          resolved: boolean
          resolved_at: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          conflict_range: unknown
          created_at?: string
          external_uid?: string | null
          feed_id?: string | null
          id?: string
          organization_id: string
          resolved?: boolean
          resolved_at?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          conflict_range?: unknown
          created_at?: string
          external_uid?: string | null
          feed_id?: string | null
          id?: string
          organization_id?: string
          resolved?: boolean
          resolved_at?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "ical_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_prices: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          id: string
          kind: Database["public"]["Enums"]["price_kind"]
          min_nights: number
          organization_id: string
          price_per_night: number
          priority: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          kind: Database["public"]["Enums"]["price_kind"]
          min_nights?: number
          organization_id: string
          price_per_night: number
          priority?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["price_kind"]
          min_nights?: number
          organization_id?: string
          price_per_night?: number
          priority?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_prices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          amenities: Json
          area_m2: number | null
          bathrooms: number
          bedrooms: number
          beds: number
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          max_guests: number
          name: string
          organization_id: string
          position: number
          property_id: string
          type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          amenities?: Json
          area_m2?: number | null
          bathrooms?: number
          bedrooms?: number
          beds?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          max_guests: number
          name: string
          organization_id: string
          position?: number
          property_id: string
          type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          amenities?: Json
          area_m2?: number | null
          bathrooms?: number
          bedrooms?: number
          beds?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          max_guests?: number
          name?: string
          organization_id?: string
          position?: number
          property_id?: string
          type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bucharest_today: { Args: { p_now?: string }; Returns: string }
      create_manual_booking: {
        Args: {
          p_adults?: number
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_email?: string
          p_full_name: string
          p_phone?: string
          p_total_amount?: number
          p_unit_id: string
        }
        Returns: string
      }
      dashboard_chart: {
        Args: { p_from: string; p_property_id?: string; p_to: string }
        Returns: {
          adults: number
          booking_id: string
          check_in: string
          check_out: string
          children: number
          currency: string
          guest_name: string
          hold_expires_at: string
          property_id: string
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          unit_id: string
        }[]
      }
      dashboard_kpis: {
        Args: { p_day?: string }
        Returns: {
          arrivals_today: number
          currency: string
          departures_today: number
          kpi_day: string
          occupancy_pct: number
          revenue_month: number
        }[]
      }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_own_storage_path: { Args: { path: string }; Returns: boolean }
      public_busy_ranges: {
        Args: { p_from: string; p_to: string; p_unit_id: string }
        Returns: {
          busy_from: string
          busy_to: string
        }[]
      }
      reorder_photos: {
        Args: {
          p_cover_id?: string
          p_photo_ids: string[]
          p_property_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      booking_source: "direct" | "booking" | "airbnb" | "altul"
      booking_status: "hold" | "confirmed" | "blocked" | "cancelled" | "expired"
      ical_provider: "booking" | "airbnb" | "altul"
      member_role: "owner"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      price_kind: "base" | "weekend" | "season"
      property_status: "activa" | "ascunsa"
      unit_type: "camera" | "apartament" | "garsoniera" | "casuta"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      booking_source: ["direct", "booking", "airbnb", "altul"],
      booking_status: ["hold", "confirmed", "blocked", "cancelled", "expired"],
      ical_provider: ["booking", "airbnb", "altul"],
      member_role: ["owner"],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      price_kind: ["base", "weekend", "season"],
      property_status: ["activa", "ascunsa"],
      unit_type: ["camera", "apartament", "garsoniera", "casuta"],
    },
  },
} as const
